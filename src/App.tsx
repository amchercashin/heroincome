import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/error-boundary';
import { MainPage } from '@/pages/main-page';
import { CategoryPage } from '@/pages/category-page';
import { AssetDetailPage } from '@/pages/asset-detail-page';
import { DataPage } from '@/pages/data-page';
import { SettingsPage } from '@/pages/settings-page';
import { BackupPage } from '@/pages/backup-page';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/category/:type" element={<CategoryPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
