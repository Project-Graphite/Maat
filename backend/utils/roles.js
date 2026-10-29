// A super admin can do everything an admin can, and also manage the admins themselves
export const isAdmin = (user) => user?.role === 'admin' || user?.role === 'superadmin';
