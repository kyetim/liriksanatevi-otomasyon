import { forwardRef } from 'react'
import type { MonthlyPayroll } from '../types'
import { MONTH_NAMES } from '../types'

interface PayrollSlipProps {
  payroll: MonthlyPayroll
  schoolName?: string
  schoolPhone?: string
}

const PayrollSlip = forwardRef<HTMLDivElement, PayrollSlipProps>(function PayrollSlip(
  { payroll, schoolName = 'Lirik Sanat Evi', schoolPhone = '' },
  ref
) {
  const fmt = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  const monthName = MONTH_NAMES[(payroll.month ?? 1) - 1]

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '148mm',
        padding: '20mm 15mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        color: '#1a1a1a',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        lineHeight: '1.5'
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '3px solid #1B3A6B', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1B3A6B', letterSpacing: '1px' }}>
              {schoolName}
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
              Müzik Okulu — Maaş Bordrosu
            </div>
            {schoolPhone && (
              <div style={{ fontSize: '10px', color: '#666' }}>Tel: {schoolPhone}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                backgroundColor: '#1B3A6B', color: '#fff',
                padding: '4px 12px', borderRadius: '4px',
                fontSize: '13px', fontWeight: 'bold'
              }}
            >
              {monthName} {payroll.year}
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              Düzenlenme: {new Date().toLocaleDateString('tr-TR')}
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Info */}
      <div
        style={{
          backgroundColor: '#f0f4fa', borderRadius: '6px',
          padding: '10px 14px', marginBottom: '16px',
          borderLeft: '4px solid #C9A84C'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1B3A6B' }}>
          {payroll.teacher_name}
        </div>
        <div style={{ fontSize: '10px', color: '#555', marginTop: '3px', display: 'flex', gap: '24px' }}>
          <span>Dönem: <strong>{monthName} {payroll.year}</strong></span>
          <span>Maaş Türü: <strong>{payroll.salary_type === 'fixed' ? 'Sabit' : payroll.salary_type === 'per_lesson' ? 'Ders Başına' : payroll.salary_type === 'hybrid' ? 'Hibrit' : 'Yüzde'}</strong></span>
          {payroll.iban && <span>IBAN: <strong>{payroll.iban}</strong></span>}
        </div>
      </div>

      {/* Payroll Breakdown Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1B3A6B', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Kalem</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Tutar</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
            <td style={{ padding: '8px 12px' }}>
              Taban Maaş
              {payroll.lesson_count > 0 && (
                <span style={{ fontSize: '10px', color: '#777', marginLeft: '8px' }}>
                  ({payroll.lesson_count} ders / {Math.round(payroll.lesson_minutes / 60 * 10) / 10} saat)
                </span>
              )}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>
              {fmt(payroll.base_amount)}
            </td>
          </tr>
          {payroll.bonus_total > 0 && (
            <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
              <td style={{ padding: '8px 12px', color: '#2e7d32' }}>+ Prim</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' }}>
                {fmt(payroll.bonus_total)}
              </td>
            </tr>
          )}
          <tr style={{ borderBottom: '1px solid #e8e8e8', backgroundColor: '#fafafa' }}>
            <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>Brüt Maaş</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>
              {fmt(payroll.gross_amount)}
            </td>
          </tr>
          {payroll.advance_deduction > 0 && (
            <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
              <td style={{ padding: '8px 12px', color: '#c62828' }}>- Avans Kesintisi</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#c62828', fontWeight: 'bold' }}>
                -{fmt(payroll.advance_deduction)}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#C9A84C' }}>
            <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
              NET ÖDEME
            </td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>
              {fmt(payroll.net_amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Payment Info */}
      {payroll.status === 'paid' && payroll.payment_date && (
        <div style={{ fontSize: '10px', color: '#555', marginBottom: '20px', textAlign: 'right' }}>
          Ödeme Tarihi: <strong>{new Date(payroll.payment_date).toLocaleDateString('tr-TR')}</strong>
          {payroll.payment_method && (
            <span style={{ marginLeft: '12px' }}>
              Yöntem: <strong>{payroll.payment_method === 'cash' ? 'Nakit' : payroll.payment_method === 'bank_transfer' ? 'Banka Transferi' : 'EFT'}</strong>
            </span>
          )}
        </div>
      )}

      {payroll.notes && (
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px', fontStyle: 'italic' }}>
          Not: {payroll.notes}
        </div>
      )}

      {/* Signature Area */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: '24px', paddingTop: '16px',
          borderTop: '1px dashed #ccc'
        }}
      >
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '6px' }} />
          <div style={{ fontSize: '10px', color: '#555' }}>Teslim Alan (Öğretmen)</div>
          <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>{payroll.teacher_name}</div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '6px' }} />
          <div style={{ fontSize: '10px', color: '#555' }}>Okul Yöneticisi</div>
          <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>{schoolName}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#aaa' }}>
        Bu belge {schoolName} tarafından düzenlenmiştir. — {new Date().toLocaleDateString('tr-TR')}
      </div>
    </div>
  )
})

export default PayrollSlip
