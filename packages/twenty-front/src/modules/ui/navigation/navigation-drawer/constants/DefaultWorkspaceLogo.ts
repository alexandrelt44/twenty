// Must be absolute: getImageAbsoluteURI rewrites relative paths to the server's
// /files endpoint. Same origin trick as auth/components/Logo.tsx.
export const DEFAULT_WORKSPACE_LOGO = `${window.location.origin}/images/icons/android/android-launchericon-192-192.png`;
