import * as React from "react";
import { useTranslation } from "react-i18next";
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

function getDefaultMethods(t: (key: string) => string): AuthMethod[] {
  return [
    { id: "api_key", name: t("auth.apiKey"), description: t("auth.apiKeyDescription") },
    { id: "oauth", name: t("auth.oauth"), description: t("auth.oauthDescription") },
  ];
}

/**
 * Login page: authentication-method selection, API key entry, and OAuth
 * callback handling. Shown when the agent requires authentication.
 *
 * @example
 * <LoginPage methods={methods} loading={loading} error={err} onAuthenticate={auth} />
 */
export function LoginPage({
  methods: methodsProp,
  loading,
  error,
  onAuthenticate,
  onBack,
  className,
}: LoginPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const methods = methodsProp ?? getDefaultMethods(t);
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
          <h1 className="text-xl font-semibold">{t("auth.authenticate")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.signInTo")}
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
            <Label htmlFor="api-key">{t("auth.apiKey")}</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("auth.apiKeyPlaceholder")}
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
                {t("auth.authenticating")}
              </>
            ) : (
              t("auth.signIn")
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
            {t("common.back")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
