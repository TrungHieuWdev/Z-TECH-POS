import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, errorInfo) {
    console.error('[app] Unhandled render error', error, errorInfo);
  }

  handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.replace('/login');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Ứng dụng gặp sự cố</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Dữ liệu của bạn vẫn an toàn. Hãy tải lại trang; nếu lỗi tiếp tục, đăng nhập lại để làm mới phiên làm việc.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()} type="button">Tải lại trang</button>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={this.handleSignOut} type="button">Đăng nhập lại</button>
          </div>
        </section>
      </main>
    );
  }
}
