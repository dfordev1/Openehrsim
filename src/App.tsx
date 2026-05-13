/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastProvider } from './components/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { CaseProvider } from './contexts/CaseContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { ClinicalLayout } from './components/ClinicalLayout';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CaseProvider>
          <NavigationProvider>
            <ClinicalLayout />
          </NavigationProvider>
        </CaseProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
