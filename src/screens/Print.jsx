import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * The Print screen is a placeholder — printing opens a dedicated popup window
 * via the Header's Print button. This route redirects back to the builder.
 */
export default function Print() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/'); }, []);
  return null;
}
