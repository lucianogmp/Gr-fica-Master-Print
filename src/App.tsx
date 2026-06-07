import { AppRoutes } from './routes';
import { Toaster } from 'react-hot-toast';
import "./index.css";

export default function App() {
  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" />
    </>
  );
}
