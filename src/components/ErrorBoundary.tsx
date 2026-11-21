import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('YourDiary ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('yourdiary_active_session_user');
      localStorage.removeItem('atmos_clerk_pub_key');
      localStorage.removeItem('atmos_supabase_url');
      localStorage.removeItem('atmos_supabase_anon_key');
    } catch {
      // ignore
    }
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0b091f 0%, #151138 100%)',
            color: '#fdfcff',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '540px',
              width: '100%',
              background: 'rgba(23, 20, 56, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.65)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '12px',
                fontFamily: '"JetBrains Mono", monospace',
                marginBottom: '16px',
              }}
            >
              <AlertTriangle size={14} />
              <span>{this.props.fallbackTitle || 'YourDiary // РЕЖИМ ВОССТАНОВЛЕНИЯ'}</span>
            </div>

            <h2
              style={{
                margin: '0 0 10px',
                fontSize: '22px',
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontWeight: 600,
                color: '#ffffff',
              }}
            >
              Сайт столкнулся с непредвиденной ошибкой
            </h2>

            <p
              style={{
                margin: '0 0 20px',
                fontSize: '13.5px',
                color: '#a5a3c2',
                lineHeight: 1.55,
              }}
            >
              Мы перехватили сбой, чтобы экран не оставался белым. Чаще всего это связано с кэшем сессии или сетевым запросом авторизации.
            </p>

            {this.state.error && (
              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  fontFamily: '"JetBrains Mono", monospace',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: '0 0 24px',
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: '"JetBrains Mono", monospace',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                Перезагрузить страницу
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e0f5',
                  fontSize: '13px',
                  fontFamily: '"JetBrains Mono", monospace',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} />
                Очистить кэш и войти
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
