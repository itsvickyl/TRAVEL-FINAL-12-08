import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ClickSpark from '../components/reactbits/ClickSpark';

export default function Layout() {
  return (
    <div className="layout">
      <ClickSpark />
      <Navbar />
      <main className="layout-content page-enter">
        <Outlet />
      </main>
    </div>
  );
}
