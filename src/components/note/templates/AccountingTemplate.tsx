/**
 * תבנית חשבונאות - מעקב אחר תנועות כספיות בין שני אנשים
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/common/Button';

export interface AccountingRow {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface AccountingTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const AccountingTemplate: React.FC<AccountingTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const [showAll, setShowAll] = useState(false);

  // המרת JSON ממחרוזת למערך
  const rows = useMemo<AccountingRow[]>(() => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }, [value]);

  // חישוב יתרה רצה
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return rows.map((row) => {
      balance += row.amount;
      return { ...row, balance };
    });
  }, [rows]);

  // הצגת רק 5 שורות אחרונות כברירת מחדל
  const displayedRows = showAll ? rowsWithBalance : rowsWithBalance.slice(-5);

  const handleAddRow = () => {
    const newRow: AccountingRow = {
      id: Date.now().toString(),
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
    };
    const updatedRows = [...rows, newRow];
    onChange(JSON.stringify(updatedRows));
  };

  const handleUpdateRow = (id: string, field: keyof AccountingRow, newValue: string | number) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, [field]: newValue } : row
    );
    onChange(JSON.stringify(updatedRows));
  };

  const handleDeleteRow = (id: string) => {
    const updatedRows = rows.filter((row) => row.id !== id);
    onChange(JSON.stringify(updatedRows));
  };

  const totalBalance = rowsWithBalance[rowsWithBalance.length - 1]?.balance || 0;
  const hiddenRowsCount = rows.length - displayedRows.length;

  return (
    <div className="space-y-4">
      {/* כפתור הצגת/הסתרת שורות ישנות */}
      {hiddenRowsCount > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showAll
              ? 'הסתר שורות ישנות'
              : `הצג ${hiddenRowsCount} שורות ישנות נוספות`}
          </button>
        </div>
      )}

      {/* טבלת תנועות */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-right">תאריך</th>
              <th className="border border-gray-300 px-3 py-2 text-right">תיאור</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-28">סכום (₪)</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-28 bg-blue-50">יתרה (₪)</th>
              {!readOnly && <th className="border border-gray-300 px-3 py-2 w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="border border-gray-300 px-3 py-8 text-center text-gray-500"
                >
                  אין תנועות עדיין
                </td>
              </tr>
            ) : (
              displayedRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`${
                    index === displayedRows.length - 1 ? 'bg-yellow-50' : ''
                  } hover:bg-gray-50`}
                >
                  {/* תאריך */}
                  <td className="border border-gray-300 px-2 py-1">
                    {readOnly ? (
                      <span className="text-gray-700">{row.date}</span>
                    ) : (
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleUpdateRow(row.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded"
                      />
                    )}
                  </td>

                  {/* תיאור */}
                  <td className="border border-gray-300 px-2 py-1">
                    {readOnly ? (
                      <span className="text-gray-700">{row.description}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleUpdateRow(row.id, 'description', e.target.value)}
                        placeholder="הזן תיאור..."
                        className="w-full px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded"
                      />
                    )}
                  </td>

                  {/* סכום */}
                  <td className="border border-gray-300 px-2 py-1">
                    {readOnly ? (
                      <span
                        className={`font-medium ${
                          row.amount > 0
                            ? 'text-green-600'
                            : row.amount < 0
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {row.amount > 0 ? '+' : ''}
                        {row.amount.toFixed(2)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          handleUpdateRow(row.id, 'amount', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded text-center"
                      />
                    )}
                  </td>

                  {/* יתרה */}
                  <td
                    className={`border border-gray-300 px-2 py-1 text-center font-bold ${
                      row.balance > 0
                        ? 'text-green-700 bg-green-50'
                        : row.balance < 0
                        ? 'text-red-700 bg-red-50'
                        : 'text-gray-700 bg-gray-50'
                    }`}
                  >
                    {row.balance > 0 ? '+' : ''}
                    {row.balance.toFixed(2)}
                  </td>

                  {/* כפתור מחיקה */}
                  {!readOnly && (
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-red-600 hover:text-red-800 text-lg"
                        title="מחק שורה"
                      >
                        🗑
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}

            {/* שורת סיכום */}
            {displayedRows.length > 0 && (
              <tr className="bg-blue-100 font-bold">
                <td className="border border-gray-300 px-3 py-2" colSpan={3}>
                  יתרה סופית
                </td>
                <td
                  className={`border border-gray-300 px-3 py-2 text-center text-lg ${
                    totalBalance > 0
                      ? 'text-green-700'
                      : totalBalance < 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}
                >
                  {totalBalance > 0 ? '+' : ''}
                  {totalBalance.toFixed(2)} ₪
                </td>
                {!readOnly && <td className="border border-gray-300"></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* כפתור הוספת שורה */}
      {!readOnly && (
        <div className="text-center">
          <Button type="button" onClick={handleAddRow} size="sm" variant="outline">
            + הוסף תנועה חדשה
          </Button>
        </div>
      )}

      {/* הסבר */}
      {!readOnly && displayedRows.length === 0 && (
        <div className="text-sm text-gray-500 text-center p-4 bg-gray-50 rounded">
          <p className="mb-2">💡 כיצד להשתמש:</p>
          <ul className="text-right space-y-1">
            <li>• סכום חיובי (+) = קיבלת כסף</li>
            <li>• סכום שלילי (-) = שילמת כסף</li>
            <li>• היתרה מחושבת אוטומטית</li>
            <li>• שורות ישנות מוסתרות אוטומטית</li>
          </ul>
        </div>
      )}
    </div>
  );
};
