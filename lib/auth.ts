import { currentUser } from '@clerk/nextjs/server';

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.publicMetadata?.role === 'admin';
}

export async function isApproved(): Promise<boolean> {
  const user = await currentUser();
  // Admins are always approved
  if (user?.publicMetadata?.role === 'admin') return true;
  return user?.publicMetadata?.approved === true;
}

export async function requireAdmin() {
  const admin = await isAdmin();
  if (!admin) {
    throw new Error('Admin access required');
  }
}

export async function requireApproved() {
  const approved = await isApproved();
  if (!approved) {
    throw new Error('Account not approved');
  }
}
