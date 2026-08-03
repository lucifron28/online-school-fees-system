'use me';
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Wallet, Smartphone, ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ParentPayPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'maya' | 'card'>('gcash');

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/parent/receipts/OR-2024-000123');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center space-x-3">
        <Link href="/parent/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Dashboard</span>
          </Button>
        </Link>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Screen #12 • PARENT - MAKE PAYMENT (ONLINE)
        </Badge>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Simulated Online Fee Payment
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose a payment channel to pay outstanding tuition and school fees
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Payment Form */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-semibold">1. Select Student & Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Child
              </label>
              <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <option>Juan Dela Cruz Jr. (Grade 10 - A)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Payment Channel Option
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('gcash')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                    selectedMethod === 'gcash'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 ring-2 ring-blue-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <Smartphone className="h-6 w-6 text-blue-600 mb-2" />
                  <span className="text-xs font-semibold">GCash</span>
                  <span className="text-[10px] text-slate-400">E-Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('maya')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                    selectedMethod === 'maya'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 ring-2 ring-emerald-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <Wallet className="h-6 w-6 text-emerald-600 mb-2" />
                  <span className="text-xs font-semibold">Maya</span>
                  <span className="text-[10px] text-slate-400">Digital Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                    selectedMethod === 'card'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-700 ring-2 ring-purple-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <CreditCard className="h-6 w-6 text-purple-600 mb-2" />
                  <span className="text-xs font-semibold">Credit / Debit</span>
                  <span className="text-[10px] text-slate-400">Visa / Mastercard</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Amount (₱)
              </label>
              <Input type="number" defaultValue="14000" className="h-10 text-sm font-bold" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total Outstanding:</span>
                <span className="font-bold text-rose-600">₱14,000.00</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Channel Fee:</span>
                <span className="font-medium text-slate-700 font-mono">₱0.00 (Waived)</span>
              </div>
            </CardContent>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-xl space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold">Amount to Pay:</span>
              <span className="text-xl font-extrabold text-emerald-600">₱14,000.00</span>
            </div>

            <Button
              onClick={handleProceed}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 font-semibold shadow-md"
            >
              <span>Proceed to Pay</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
