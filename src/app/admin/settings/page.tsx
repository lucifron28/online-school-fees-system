'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Save, CheckCircle2, Shield } from 'lucide-react';

export default function AdminSettingsPage() {
  const [isSaved, setIsSaved] = useState(false);
  const [form, setForm] = useState({
    schoolName: 'Online School Fees Monitoring & Payment System',
    shortName: 'OSFS',
    address: '123 Education Way, Manila, Philippines',
    email: 'info@schoolfees.example.com',
    phone: '+63 (2) 8123-4567',
    receiptPrefix: 'OSFS',
    currencyCode: 'PHP',
    timezone: 'Asia/Manila',
    studentPortalEnabled: true,
    activeSchoolYear: 'SY 2024–2025',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Admin • INSTITUTION SETTINGS
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Institution & System Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure global institutional parameters, receipt metadata, active school year, and
            feature flags
          </p>
        </div>

        {isSaved && (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"
          >
            <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" />
            <span>Settings Saved Successfully</span>
          </Badge>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Institution Info */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">1. Institution Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Institution Full Name
                </label>
                <Input
                  value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Short Name / Abbreviation
                </label>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                  className="h-9 font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Official Address
              </label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-9 font-mono text-xs"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Phone
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-9 font-mono text-xs"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & System Parameters */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">
              2. Financial & System Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Receipt Prefix
                </label>
                <Input
                  value={form.receiptPrefix}
                  onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value })}
                  className="h-9 font-mono text-xs font-bold"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency Code
                </label>
                <Input
                  value={form.currencyCode}
                  onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                  className="h-9 font-mono text-xs font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Timezone
                </label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="h-9 font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Active School Year
                </label>
                <select
                  value={form.activeSchoolYear}
                  onChange={(e) => setForm({ ...form, activeSchoolYear: e.target.value })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="SY 2024–2025">SY 2024–2025 (ACTIVE)</option>
                  <option value="SY 2025–2026">SY 2025–2026 (DRAFT)</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <input
                  type="checkbox"
                  id="studentPortal"
                  checked={form.studentPortalEnabled}
                  onChange={(e) => setForm({ ...form, studentPortalEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="studentPortal"
                  className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  Enable Student Portal Access
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-10 bg-blue-600 px-6 text-xs font-semibold text-white shadow-md hover:bg-blue-700"
          >
            <Save className="mr-1.5 h-4 w-4" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
