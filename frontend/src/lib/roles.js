// A super admin can do everything an admin can, and also manage the admins themselves
export const isAdmin = (user) => user?.role === 'admin' || user?.role === 'superadmin'

export const ROLE_LABELS = { user: 'User', admin: 'Admin', superadmin: 'Super admin' }

// Admins can delete regular users. Only the super admin manages admins, and nobody manages themselves
export const canManage = (me, user) =>
  me._id !== user._id && (user.role === 'user' || (user.role === 'admin' && me.role === 'superadmin'))

// Only the super admin changes roles
export const canChangeRole = (me, user) => me.role === 'superadmin' && canManage(me, user)
