import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Shield, UserCheck, UserX, Mail, RotateCcw, Clock, CheckCircle, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-superadmin-token": token, ...(opts?.headers as any) },
  });
}

type SARole = "super_admin" | "admin";
type SAStatus = "active" | "inactive";
type InviteStatus = "pending" | "expired" | "accepted";

interface SAUser {
  id: number;
  name: string;
  email: string;
  role: SARole;
  status: SAStatus;
  inviteStatus: InviteStatus;
  notes: string | null;
  createdAt: string;
}

const ROLE_CONFIG: Record<SARole, { label: string; color: string; description: string }> = {
  super_admin: { label: "Super Admin", color: "bg-emerald-900/50 text-emerald-200 border-emerald-700/40", description: "Full platform access including team management" },
  admin:       { label: "Admin",       color: "bg-slate-700/60 text-slate-300 border-slate-600/40",    description: "Manage tenants and view all data" },
};

const INVITE_STATUS_CONFIG: Record<InviteStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending:  { label: "Invite Pending", icon: <Clock className="w-3 h-3" />,        color: "bg-amber-900/40 text-amber-300 border-amber-700/40" },
  expired:  { label: "Invite Expired", icon: <AlertCircle className="w-3 h-3" />,  color: "bg-red-900/40 text-red-300 border-red-700/40" },
  accepted: { label: "Active",         icon: <CheckCircle className="w-3 h-3" />,  color: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
};

const defaultEditForm = { name: "", email: "", role: "admin" as SARole, notes: "", status: "active" as SAStatus };
const defaultCreateForm = { name: "", email: "", role: "admin" as SARole, notes: "" };

export default function SuperAdminTeam() {
  const { toast } = useToast();
  const [users, setUsers] = useState<SAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<SAUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SAUser | null>(null);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/superadmin/team");
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch {
      toast({ title: "Failed to load team members", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditingUser(null); setCreateForm(defaultCreateForm); setError(""); setShowDialog(true); };
  const openEdit = (u: SAUser) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, notes: u.notes ?? "", status: u.status });
    setError(""); setShowDialog(true);
  };

  const handleCreate = async () => {
    setError("");
    if (!createForm.name.trim() || !createForm.email.trim()) { setError("Name and email are required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/superadmin/team", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          role: createForm.role,
          notes: createForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send invitation"); return; }
      toast({ title: "Invitation sent!", description: `An invite email has been sent to ${createForm.email}.` });
      setShowDialog(false); await fetchUsers();
    } catch { setError("Connection error."); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    setError("");
    if (!editForm.name.trim() || !editForm.email.trim()) { setError("Name and email are required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/superadmin/team/${editingUser!.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          status: editForm.status,
          notes: editForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      toast({ title: "Updated" });
      setShowDialog(false); await fetchUsers();
    } catch { setError("Connection error."); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/superadmin/team/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Team member removed" }); setDeleteTarget(null); await fetchUsers();
    } catch { toast({ title: "Failed to remove", variant: "destructive" }); }
  };

  const handleResendInvite = async (u: SAUser) => {
    setResendingId(u.id);
    try {
      const res = await apiFetch(`/superadmin/team/${u.id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed to resend", variant: "destructive" }); return; }
      toast({ title: "Invitation resent", description: `A new invite email has been sent to ${u.email}.` });
      await fetchUsers();
    } catch { toast({ title: "Connection error", variant: "destructive" }); }
    finally { setResendingId(null); }
  };

  const toggleStatus = async (u: SAUser) => {
    const newStatus = u.status === "active" ? "inactive" : "active";
    try {
      await apiFetch(`/superadmin/team/${u.id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      toast({ title: newStatus === "active" ? "Activated" : "Deactivated" }); await fetchUsers();
    } catch { toast({ title: "Failed to update status", variant: "destructive" }); }
  };

  return (
    <div className="p-8 space-y-6 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-slate-400 mt-1 text-sm">Manage sub-admin accounts with access to the super admin console.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 text-white hover:opacity-90" style={{ backgroundColor: "#3ab549" }}>
          <Plus className="w-4 h-4" /> Invite Member
        </Button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.entries(ROLE_CONFIG) as [SARole, typeof ROLE_CONFIG[SARole]][]).map(([role, cfg]) => (
          <div key={role} className={`rounded-xl border px-4 py-3 ${cfg.color}`}>
            <p className="text-sm font-semibold">{cfg.label}</p>
            <p className="text-xs mt-0.5 opacity-70">{cfg.description}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-900/50" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-semibold text-slate-300">No sub-admins yet</p>
          <p className="text-sm text-slate-500 mt-1">Invite team members who can help manage the platform.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          {users.map((user, idx) => {
            const inviteCfg = INVITE_STATUS_CONFIG[user.inviteStatus];
            return (
              <div
                key={user.id}
                className={`flex items-center gap-4 px-5 py-4 ${idx !== users.length - 1 ? "border-b border-slate-800" : ""} ${user.status === "inactive" ? "opacity-40" : ""} bg-slate-900/50`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#3ab54920", border: "1px solid #3ab54940" }}>
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{user.name}</p>
                    <Badge variant="outline" className={`text-xs ${ROLE_CONFIG[user.role]?.color}`}>
                      {ROLE_CONFIG[user.role]?.label}
                    </Badge>
                    <Badge variant="outline" className={`text-xs flex items-center gap-1 ${inviteCfg.color}`}>
                      {inviteCfg.icon}
                      {inviteCfg.label}
                    </Badge>
                    {user.status === "inactive" && (
                      <Badge variant="outline" className="text-xs bg-slate-800 text-slate-500 border-slate-700">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Resend invite button — only for pending/expired */}
                  {user.inviteStatus !== "accepted" && (
                    <button
                      onClick={() => handleResendInvite(user)}
                      disabled={resendingId === user.id}
                      title="Resend invitation email"
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-300 transition-colors disabled:opacity-40"
                    >
                      {resendingId === user.id
                        ? <RotateCcw className="w-4 h-4 animate-spin" />
                        : <Mail className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => toggleStatus(user)} title={user.status === "active" ? "Deactivate" : "Activate"} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors">
                    {user.status === "active" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
                  </button>
                  <button onClick={() => openEdit(user)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(user)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showDialog && !editingUser} onOpenChange={open => { if (!open) setShowDialog(false); }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" /> Invite Sub-Admin
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              They'll receive an email with a link to set their password and access the console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Full Name <span className="text-red-400">*</span></Label>
              <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email <span className="text-red-400">*</span></Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Role</Label>
              <Select value={createForm.role} onValueChange={(v: any) => setCreateForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Notes (optional)</Label>
              <Textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes…" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2 text-white hover:opacity-90" style={{ backgroundColor: "#3ab549" }}>
              <Mail className="w-4 h-4" />
              {saving ? "Sending…" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showDialog && !!editingUser} onOpenChange={open => { if (!open) setShowDialog(false); }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Member</DialogTitle>
            <DialogDescription className="text-slate-400">Update this sub-admin's details and role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Full Name <span className="text-red-400">*</span></Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email <span className="text-red-400">*</span></Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Role</Label>
                <Select value={editForm.role} onValueChange={(v: any) => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Status</Label>
                <Select value={editForm.status} onValueChange={(v: any) => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Notes (optional)</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes…" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="text-white hover:opacity-90" style={{ backgroundColor: "#3ab549" }}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Remove <strong className="text-slate-200">{deleteTarget?.name}</strong>? They will lose console access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
