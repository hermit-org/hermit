import * as React from "react";
import { KeyRound, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface AuthMethod {
  id: string;
  name: string;
  description?: string;
}

export interface LoginPageProps {
  /** Agent-reported authentication methods (from initialize). */
  methods?: AuthMethod[];
  /** Whether authentication is in progress. */
  loading?: boolean;
  /** Error message from the last attempt. */
  error?: string | null;
  /** Submit credentials for the given method id. */
  onAuthenticate: (methodId: string, apiKey: string) => void;
  /** Skip / go back (when auth is optional). */
  onBack?: () => void;
  className?: string;
}

const DEFAULT_METHODS: AuthMethod[] = [
  { id: "api_key", name: "API Key", description: "Use an agent API key" },
  { id: "oauth", name: "OAuth", description: "Sign in via OAuth provider" },
];

/**
 * Login page: authentication-method selection, API key entry, and OAuth
 * callback handling. Shown when the agent requires authentication.
 *
 * @example
 * <LoginPage methods={methods} loading={loading} error={err} onAuthenticate={auth} />
 */
export function LoginPage({
  methods = DEFAULT_METHODS,
  loading,
  error,
  onAuthenticate,
  onBack,
  className,
}: LoginPageProps): React.JSX.Element {
  const [selected, setSelected] = React.useState(methods[0]?.id ?? "api_key");
  const [apiKey, setApiKey] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || loading) return;
    onAuthenticate(selected, apiKey.trim());
  };

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-background p-6",
        className,
      )}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Authenticate</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to connect to the ACP agent.
          </p>
        </div>

        <div className="space-y-2">
          {methods.map((m) => {
            const active = m.id === selected;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  {m.description ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {m.description}
                    </div>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "h-3 w-3 rounded-full border-2",
                    active ? "border-primary bg-primary" : "border-border",
                  )}
                />
              </button>
            );
          })}
        </div>

        <Separator />

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              autoFocus
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !apiKey.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Authenticating…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : null}
      </div>
    </div>
  );
}
