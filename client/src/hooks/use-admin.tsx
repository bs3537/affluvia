import { useAuth } from "./use-auth";

const ADMIN_EMAIL = "bhav@live.com";

export function useAdmin() {
  const { user } = useAuth();
  
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  return {
    isAdmin,
    adminEmail: ADMIN_EMAIL,
  };
}