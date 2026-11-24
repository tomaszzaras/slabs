// What the rest of the app may know about the session without importing the login provider: the current user's id and a
// function that gives the session token for the API. auth/index.tsx fills it in; tests and the no-login build leave it empty.
let getter: (() => Promise<string | null>) | null = null;
let userId: string | null = null;

export function setAuthBridge(next: { userId: string | null; getToken: (() => Promise<string | null>) | null }): void {
  userId = next.userId;
  getter = next.getToken;
}
/** The session token for the Authorization header, or null (signed out, login off). */
export const getAuthToken = async (): Promise<string | null> => (getter ? getter() : null);
export const currentUserId = (): string | null => userId;
