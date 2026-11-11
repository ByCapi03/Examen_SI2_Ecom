import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Evita que un error de render en una pantalla deje todo el panel en blanco. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ margin: '40px auto', maxWidth: 480, textAlign: 'center', padding: 28, borderRadius: 16, background: 'var(--atemporal-white)', border: '1px solid var(--atemporal-border)', color: 'var(--atemporal-text)' }}>
        <h3 style={{ margin: '0 0 8px' }}>Algo salió mal en esta pantalla</h3>
        <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: 'var(--atemporal-muted)' }}>El resto del panel sigue funcionando. Puedes reintentar o ir a otra sección.</p>
        <button onClick={() => this.setState({ error: null })} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--atemporal-green)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
      </div>
    );
  }
}
