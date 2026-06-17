import { AppRoutes } from './routes';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './hooks/useTheme';
import "./index.css";
import "./theme.css";

export default function App() {
  useTheme();

  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" />
    </>
  );
}
