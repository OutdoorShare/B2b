import { useState, useEffect, useCallback } from "react";
import { getAdminSession } from "@/lib/admin-nav";
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
import { Users, Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, UserCheck, UserX } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Role = "owner" | "manager" | "staff";
type Status = "active" | "inactive";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
  notes: string | null;
  createdAt: string;
}

const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
  owner:   { label: "Owner",   color: "bg-primary/10 text-primary border-primary/20",          description: "Full access to all features" },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-800 border-blue-200",              description: "Bookings, listings, claims, analytics" },
  staff:   { label: "Staff",   color: "bg-slate-100 text-slate-700 border-slate-200",           description: "View bookings and check-in / check-out only" },
};

const defaultForm = { name: "", email: "", password: "", confirmPassword: "", role: "staff" as Role, notes: "", status: "active" as Status };

export default function AdminTeam() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const adminToken = () => {
    const t = getAdminSession()?.token;
    return t ? { "x-admin-token": t } : {};
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/team`, { headers: adminToken() });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch {
      toast({ title: "Failed to load team members", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(defaultForm);
    setError("");
    setShowDialog(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", confirmPassword: "", role: user.role, notes: user.notes ?? "", status: user.status });
    setError("");
    setShowDialog(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    if (!editingUser && !form.password) { setError("Password is required for new team members."); return; }
    if (form.password && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password && form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }

    setSaving(true);
    try {
      const url = editingUser ? `${BASE}/api/admin/team/${editingUser.id}` : `${BASE}/api/admin/team`;
      const method = editingUser ? "PUT" : "POST";
      const body: any = { name: form.name, email: form.email, role: form.role, status: form.status, notes: form.notes || null };
      if (form.password) body.password = form.password;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...adminToken() }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      toast({ title: editingUser ? "Team member updated" : "Team member added" });
      setShowDialog(false);
      await fetchUsers();
    } catch {
      setError("Connection error. Please try again.");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${BASE}/api/admin/team/${deleteTarget.id}`, { method: "DELETE", headers: adminToken() });
      if (!res.ok) throw new Error();
      toast({ title: "Team member removed" });
      setDeleteTarget(null);
      await fetchUsers();
    } catch {
      toast({ title: "Failed to remove team member", variant: "destructive" });
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`${BASE}/api/admin/team/${user.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...adminToken() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast({ title: newStatus === "active" ? "Team member activated" : "Team member deactivated" });
      await fetchUsers();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground mt-1">Manage staff access and roles for the admin dashboard.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => (
          <div key={role} className={`rounded-xl border px-4 py-3 ${cfg.color}`}>
            <p className="text-sm font-semibold capitalize">{cfg.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{cfg.description}</p>
          </div>
        ))}
      </div>

      {/* Member list */}
      {loading ? (
        <div className="rounded-xl border divide-y animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted/30" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No team members yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add staff members who need access to this dashboard.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {users.map((user, idx) => (
            <div
              key={user.id}
              className={`flex items-center gap-4 px-5 py-4 ${idx !== users.length - 1 ? "border-b" : ""} ${user.status === "inactive" ? "opacity-50 bg-muted/20" : "bg-background"}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{user.name}</p>
                  <Badge variant="outline" className={`text-xs ${ROLE_CONFIG[user.role]?.color}`}>
                    {ROLE_CONFIG[user.role]?.label}
                  </Badge>
                  {user.status === "inactive" && (
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(user)} title={user.status === "active" ? "Deactivate" : "Activate"}>
                  {user.status === "active" ? <UserX className="w-4 h-4 text-muted-foreground" /> : <UserCheck className="w-4 h-4 text-primary" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)}>
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(user)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update this team member's details and access level." : "Create login credentials for a new staff member."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{editingUser ? "New Password (leave blank to keep)" : "Password"} {!editingUser && <span className="text-destructive">*</span>}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? "Leave blank to keep current" : "Min. 6 characters"}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {form.password && (
              <div className="space-y-1.5">
                <Label>Confirm Password <span className="text-destructive">*</span></Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat password"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes about this team member…" />
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (editingUser ? "Save Changes" : "Add Member")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.name}</strong> from the team? They will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
