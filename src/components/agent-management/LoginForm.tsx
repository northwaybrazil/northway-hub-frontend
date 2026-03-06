import type { Dispatch, FormEvent, SetStateAction } from 'react';

interface LoginFormState {
  email: string;
  password: string;
}

interface LoginFormProps {
  loginForm: LoginFormState;
  setLoginForm: Dispatch<SetStateAction<LoginFormState>>;
  authError: string | null;
  isAuthenticating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function LoginForm({
  loginForm,
  setLoginForm,
  authError,
  isAuthenticating,
  onSubmit
}: LoginFormProps) {
  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>Northway Hub</span>
        </div>

        <h1>Admin Console</h1>
        <p className="login-subtitle">Acesse para gerenciar agentes e integrações.</p>

        <label className="field-label" htmlFor="email">
          email
        </label>
        <input
          id="email"
          type="email"
          value={loginForm.email}
          onChange={(event) =>
            setLoginForm((current) => ({
              ...current,
              email: event.target.value
            }))
          }
          required
        />

        <label className="field-label" htmlFor="password">
          password
        </label>
        <input
          id="password"
          type="password"
          value={loginForm.password}
          onChange={(event) =>
            setLoginForm((current) => ({
              ...current,
              password: event.target.value
            }))
          }
          required
        />

        <button className="primary-button" type="submit" disabled={isAuthenticating}>
          {isAuthenticating ? 'Entrando...' : 'Entrar'}
        </button>

        {authError && <p className="message error">{authError}</p>}
      </form>
    </div>
  );
}
