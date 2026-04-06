import { Router, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  conversations,
  messages,
  listingsTable,
  businessProfileTable,
  tenantsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `You are OutdoorBot, the friendly AI assistant for the OutdoorShare marketplace — an outdoor gear and equipment rental platform.

You help customers:
- Find the right gear for their adventures (camping, kayaking, hiking, skiing, mountain biking, climbing, etc.)
- Understand rental pricing, availability, and policies
- Compare equipment options and bundles
- Plan outdoor trips and adventures
- Navigate the booking process
- Answer questions about protection plans and insurance

Personality: Enthusiastic about the outdoors, knowledgeable about outdoor activities, concise and helpful. Use a warm, adventurous tone. Keep responses brief unless the user needs detailed information.

When asked about specific gear or listings, provide helpful general guidance since you may not have real-time inventory data. Encourage users to browse listings on the marketplace.

If a user wants to book gear, direct them to browse listings and use the booking flow.`;

async function getListingContext(): Promise<string> {
  try {
    const listings = await db
      .select({
        name: listingsTable.name,
        category: categoriesTable.name,
        dailyRate: listingsTable.dailyRate,
        location: businessProfileTable.city,
      })
      .from(listingsTable)
      .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .leftJoin(businessProfileTable, eq(listingsTable.tenantId, businessProfileTable.tenantId))
      .where(eq(listingsTable.status, "active"))
      .limit(20);

    if (listings.length === 0) return "";

    const listingLines = listings.map((l) => {
      const rate = l.dailyRate ? `$${Number(l.dailyRate).toFixed(0)}/day` : "";
      const loc = l.location ? ` in ${l.location}` : "";
      return `- ${l.name}${l.category ? ` (${l.category})` : ""}${rate ? ` — ${rate}` : ""}${loc}`;
    });

    return `\n\nCurrently available listings on the marketplace:\n${listingLines.join("\n")}`;
  } catch {
    return "";
  }
}

// POST /openai/conversations
router.post("/openai/conversations", async (req: Request, res: Response) => {
  try {
    const { title = "New conversation" } = req.body as { title?: string };
    const [conv] = await db.insert(conversations).values({ title }).returning();
    res.status(201).json(conv);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// GET /openai/conversations
router.get("/openai/conversations", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// GET /openai/conversations/:id
router.get("/openai/conversations/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    res.json({ ...conv, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// DELETE /openai/conversations/:id
router.delete("/openai/conversations/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (deleted.length === 0) { res.status(404).json({ error: "Conversation not found" }); return; }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// GET /openai/conversations/:id/messages
router.get("/openai/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    res.json(msgs);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// POST /openai/conversations/:id/messages  — streaming SSE
router.post("/openai/conversations/:id/messages", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body as { content?: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    // Save user message
    await db.insert(messages).values({ conversationId: id, role: "user", content: content.trim() });

    // Build history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
      .limit(40);

    const listingContext = await getListingContext();
    const systemContent = SYSTEM_PROMPT + listingContext;

    const chatMessages = [
      { role: "system" as const, content: systemContent },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Setup SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: chatMessages,
      stream: true,
      max_completion_tokens: 8192,
    });

    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assistantContent += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: assistantContent,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("[openai route]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message ?? "Error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
