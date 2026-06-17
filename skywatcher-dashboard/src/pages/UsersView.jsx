import { useCallback, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { Plus, Edit2, UserX, CheckCircle, XCircle } from 'lucide-react'
import { usePolling }  from '../hooks/usePolling'
import { useToast }    from '../context/ToastContext'
import {
  fetchUsers, createUser, updateUser, deactivateUser,
} from '../utils/api'
import PageHeader from '../components/PageHeader'

const ROLES = ['admin', 'ground_staff']

const ROLE_STYLE = {
  admin:        { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623', label: 'Admin' },
  ground_staff: { bg: 'rgba(0,204,125,0.12)',   color: '#00CC7D', label: 'Ground Staff' },
}

const EMPTY_FORM = { username: '', password: '', role: 'ground_staff', email: '' }

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
        width: '100%',
        maxWidth: 440,
        margin: '0 16px',
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
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={inputStyle}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_STYLE[r]?.label ?? r}</option>
              ))}
            </select>
          </Field>

          <Field label="Email (for critical-anomaly alerts)">
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="staff@gmail.com"
              style={inputStyle}
            />
          </Field>

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
  const isMobile = useIsMobile()
  const fetchFn = useCallback(() => fetchUsers(), [])
  const { data: users, loading, refresh } = usePolling(fetchFn, 5000)

  const [modal, setModal]   = useState(null)   // null | 'create' | { user }
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  function openCreate() { setForm(EMPTY_FORM); setFormErr(''); setModal('create') }
  function openEdit(u)  { setForm({ username: u.username, password: '', role: u.role, email: u.email ?? '' }); setFormErr(''); setModal(u) }
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
      >
        <button onClick={openCreate} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Plus size={14} /> New User
        </button>
      </PageHeader>

      <div style={{ padding: isMobile ? '14px 14px 80px' : 24 }}>
        <div style={{
          background: isMobile ? 'transparent' : 'var(--surface)',
          border: isMobile ? 'none' : '1px solid var(--border)',
          borderRadius: 13, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found.</div>
          ) : isMobile ? (
            /* Mobile: card list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(u => {
                const inactive = !u.active
                return (
                  <div key={u.id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14,
                    opacity: inactive ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-2)' }}>#{u.id}</span>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{u.username}</span>
                      </div>
                      <RoleChip role={u.role} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap', marginBottom: 12 }}>
                      <span>{u.email || 'no email'}</span>
                      <span>·</span>
                      {u.active
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}><CheckCircle size={11} /> Active</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}><XCircle size={11} /> Inactive</span>
                      }
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(u)} style={{ ...iconBtn, padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      {u.active && (
                        <button onClick={() => handleDeactivate(u)} style={{ ...iconBtn, padding: '7px 12px', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserX size={12} /> Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Username', 'Role', 'Email', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--surface-2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const inactive = !u.active

                  return (
                    <tr key={u.id} style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: inactive ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <td style={td}><span style={{ fontFamily: 'monospace', color: 'var(--muted-2)' }}>#{u.id}</span></td>
                      <td style={td}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.username}</span></td>
                      <td style={td}><RoleChip role={u.role} /></td>
                      <td style={{ ...td, color: 'var(--muted-2)' }}>{u.email || '—'}</td>
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
