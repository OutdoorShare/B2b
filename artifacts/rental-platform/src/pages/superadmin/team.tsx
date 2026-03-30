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
import { Users, Plus, Pencil, Trash2, Eye, EyeOff, Shield, UserCheck, UserX } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getKey() { return localStorage.getItem("superadmin_key") ?? ""; }
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const key = getKey();
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["x-superadmin-key"] = key;
  if (token && !key) headers["x-superadmin-token"] = token;
  return fetch(`${BASE}/api${path}`, { ...opts, headers: { ...headers, ...(opts?.headers as any) } });
}

type SARole = "super_admin" | "admin";
type SAStatus = "active" | "inactive";

interface SAUser {
  id: number;
  name: string;
  email: string;
  role: SARole;
  status: SAStatus;
  notes: string | null;
  createdAt: string;
}

const ROLE_CONFIG: Record<SARole, { label: string; color: string; description: string }> = {
  super_admin: { label: "Super Admin", color: "bg-violet-900/50 text-violet-200 border-violet-700/40", description: "Full platform access including team management" },
  admin:       { label: "Admin",       color: "bg-slate-700/60 text-slate-300 border-slate-600/40",    description: "Manage tenants and view all data" },
};

const defaultForm = { name: "", email: "", password: "", confirmPassword: "", role: "admin" as SARole, notes: "", status: "active" as SAStatus };

export default function SuperAdminTeam() {
  const { toast } = useToast();
  const [users, setUsers] = useState<SAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<SAUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SAUser | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const openCreate = () => { setEditingUser(null); setForm(defaultForm); setError(""); setShowDialog(true); };
  const openEdit = (u: SAUser) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: "", confirmPassword: "", role: u.role, notes: u.notes ?? "", status: u.status });
    setError(""); setShowDialog(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    if (!editingUser && !form.password) { setError("Password is required for new accounts."); return; }
    if (form.password && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password && form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      const url = editingUser ? `/superadmin/team/${editingUser.id}` : "/superadmin/team";
      const method = editingUser ? "PUT" : "POST";
      const body: any = { name: form.name, email: form.email, role: form.role, status: form.status, notes: form.notes || null };
      if (form.password) body.password = form.password;
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      toast({ title: editingUser ? "Updated" : "Team member added" });
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
        <Button onClick={openCreate} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4" /> Add Member
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
          <p className="text-sm text-slate-500 mt-1">Add team members who can help manage the platform.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          {users.map((user, idx) => (
            <div
              key={user.id}
              className={`flex items-center gap-4 px-5 py-4 ${idx !== users.length - 1 ? "border-b border-slate-800" : ""} ${user.status === "inactive" ? "opacity-40" : ""} bg-slate-900/50`}
            >
              <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{user.name}</p>
                  <Badge variant="outline" className={`text-xs ${ROLE_CONFIG[user.role]?.color}`}>
                    {ROLE_CONFIG[user.role]?.label}
                  </Badge>
                  {user.status === "inactive" && (
                    <Badge variant="outline" className="text-xs bg-slate-800 text-slate-500 border-slate-700">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleStatus(user)} title={user.status === "active" ? "Deactivate" : "Activate"} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors">
                  {user.status === "active" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-violet-400" />}
                </button>
                <button onClick={() => openEdit(user)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(user)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">{editingUser ? "Edit Member" : "Add Sub-Admin"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingUser ? "Update this sub-admin's details and role." : "Create a new sub-admin login for the console."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Full Name <span className="text-red-400">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email <span className="text-red-400">*</span></Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser && (
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">{editingUser ? "New Password (blank = keep)" : "Password"} {!editingUser && <span className="text-red-400">*</span>}</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? "Leave blank to keep" : "Min. 6 characters"} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {form.password && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">Confirm Password <span className="text-red-400">*</span></Label>
                <Input type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300">Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any notes…" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">{saving ? "Saving…" : (editingUser ? "Save" : "Add Member")}</Button>
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
