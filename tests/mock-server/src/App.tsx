import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { fetchScenario } from './scenario';
import Home from './pages/Home';
import SelectParking from './pages/SelectParking';
import Checkout from './pages/Checkout';
import PostPurchase from './pages/PostPurchase';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchScenario().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/select-parking" element={<SelectParking />} />
      <Route path="/checkout/:id" element={<Checkout />} />
      <Route path="/post-purchase" element={<PostPurchase />} />
    </Routes>
  );
}
