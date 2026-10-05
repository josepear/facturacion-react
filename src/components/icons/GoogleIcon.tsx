type GoogleIconProps = {
  className?: string;
};

export function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.92h5.45c-.24 1.26-.96 2.33-2.05 3.05l3.31 2.57c1.93-1.78 3.04-4.4 3.04-7.54 0-.72-.06-1.4-.19-2.06H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.75 0 5.06-.91 6.74-2.46l-3.31-2.57c-.91.62-2.08.99-3.43.99-2.65 0-4.9-1.79-5.7-4.19l-3.42 2.65A10.18 10.18 0 0 0 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.3 13.77a6.17 6.17 0 0 1 0-3.54l-3.42-2.65a10.15 10.15 0 0 0 0 8.84l3.42-2.65z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.04c1.46 0 2.76.5 3.79 1.47l2.84-2.84C17.05 3.2 14.75 2 12 2a10.18 10.18 0 0 0-9.12 5.58l3.42 2.65c.8-2.4 3.05-4.19 5.7-4.19z"
      />
    </svg>
  );
}
