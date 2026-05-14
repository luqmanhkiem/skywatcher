import { useCallback, useState } from 'react'
import { Plus, Edit2, UserX, CheckCircle, XCircle } from 'lucide-react'
import { usePolling }  from '../hooks/usePolling'
import { useToast }    from '../context/ToastContext'
import {
  fetchUsers, createUser, updateUser, deactivateUser,
} from '../utils/api'
import PageHeader from '../components/PageHeader'

const ROLES = ['admin', 'ground_staff']
const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const ROLE_STYLE = {
  admin:        { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623', label: 'Admin' },
  ground_staff: { bg: 'rgba(0,204,125,0.12)',   color: '#00CC7D', label: 'Ground Staff' },
}

const EMPTY_FORM = { username: '', password: '', role: 'ground_staff', checkpoint: '' }

function RoleChip({ role }) {
  const s = ROLE_STYLE[role] ?? { bg: 'var(--surface-3)', color: 'var(--muted-2)', label: role }
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      padding: '2px 7px', borderRadius: 4, fontSize: 8, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  )
}

function Modal({ title, form, setForm, onSave, onClose, isEdit, saving, error }) {
  const isStaff = form.role === 'ground_staff'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,15,15,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-2)',
        borderTop: '2px solid var(--accent)',
        borderRadius: 12,
        padding: '28px 28px 24px',
        width: 440,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)', marginBottom: 22 }}>{title}</h2>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: 'var(--danger)',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Username">
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="e.g. staff_john"
              style={inputStyle}
            />
          </Field>

          <Field label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '••••••  (unchanged)' : 'Min 6 characters'}
              style={inputStyle}
            />
          </Field>

          <Field label="Role">
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value, checkpoint: '' }))}
              style={inputStyle}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_STYLE[r]?.label ?? r}</option>
              ))}
            </select>
          </Field>

          {isStaff && (
            <Field label="Checkpoint">
              <select
                value={form.checkpoint}
                onChange={e => setForm(f => ({ ...f, checkpoint: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— None —</option>
                {CHECKPOINTS.map(cp => (
                  <option key={cp} value={cp}>{cp.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
          )}

        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: 8, padding: '9px 12px',
  fontSize: 13, color: 'var(--text)',
  outline: 'none',
}
const btnPrimary = {
  background: 'var(--accent)', color: '#000',
  border: 'none', borderRadius: 8, padding: '9px 20px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '0.02em',
  transition: 'all 0.15s',
}
const btnSecondary = {
  background: 'transparent', color: 'var(--muted-2)',
  border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px',
  fontSize: 13, cursor: 'pointer',
}

export default function UsersView() {
  const { showToast } = useToast()
  const fetchFn = useCallback(() => fetchUsers(), [])
  const { data: users, loading, refresh } = usePolling(fetchFn, 5000)

  const [modal, setModal]   = useState(null)   // null | 'create' | { user }
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  function openCreate() { setForm(EMPTY_FORM); setFormErr(''); setModal('create') }
  function openEdit(u)  { setForm({ username: u.username, password: '', role: u.role, checkpoint: u.checkpoint ?? '' }); setFormErr(''); setModal(u) }
  function closeModal() { setModal(null) }

  async function handleSave() {
    setSaving(true); setFormErr('')
    try {
      if (modal === 'create') {
        await createUser(form)
        showToast(`User "${form.username}" created`, 'success')
      } else {
        await updateUser(modal.id, form)
        showToast(`User "${form.username}" updated`, 'success')
      }
      closeModal()
      if (refresh) refresh()
    } catch (err) {
      setFormErr(err.response?.data?.error ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(u) {
    if (!window.confirm(`Deactivate "${u.username}"? They will no longer be able to log in.`)) return
    try {
      await deactivateUser(u.id)
      showToast(`"${u.username}" deactivated`, 'warning')
      if (refresh) refresh()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Failed to deactivate user', 'anomaly')
    }
  }

  const rows = Array.isArray(users) ? users : []

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="User Management"
        subtitle="Create and manage admin and ground staff accounts"
        action={
          <button onClick={openCreate} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Plus size={14} /> New User
          </button>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 13, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Username', 'Role', 'Assignment', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--surface-2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const inactive = !u.active
                  const assignment = u.role === 'ground_staff' && u.checkpoint
                    ? u.checkpoint.replace('_', ' ')
                    : '—'

                  return (
                    <tr key={u.id} style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: inactive ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <td style={td}><span style={{ fontFamily: 'monospace', color: 'var(--muted-2)' }}>#{u.id}</span></td>
                      <td style={td}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.username}</span></td>
                      <td style={td}><RoleChip role={u.role} /></td>
                      <td style={td}><span style={{ color: 'var(--muted-2)' }}>{assignment}</span></td>
                      <td style={td}>
                        {u.active
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontSize: 12 }}><CheckCircle size={12} /> Active</span>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 12 }}><XCircle size={12} /> Inactive</span>}
                      </td>
                      <td style={{ ...td, color: 'var(--muted-2)', whiteSpace: 'nowrap' }}>
                        {u.created_at ? u.created_at.slice(0, 10) : '—'}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(u)} style={iconBtn} title="Edit">
                            <Edit2 size={13} />
                          </button>
                          {u.active && (
                            <button onClick={() => handleDeactivate(u)} style={{ ...iconBtn, color: 'var(--danger)' }} title="Deactivate">
                              <UserX size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Create New User' : `Edit — ${modal.username}`}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={closeModal}
          isEdit={modal !== 'create'}
          saving={saving}
          error={formErr}
        />
      )}
    </div>
  )
}

const td = { padding: '12px 16px', verticalAlign: 'middle' }
const iconBtn = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '5px 8px',
  color: 'var(--muted-2)', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
}
