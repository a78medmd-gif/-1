import { useState } from 'react';
import { checklistItems, type Answer } from '../engine/checklist.ts';
import type { AppSettings } from '../db/db.ts';
import ChecklistForm from './ChecklistForm.tsx';

export default function ChecklistPage({ settings, onUse }: { settings: AppSettings; onUse: (a: (Answer | undefined)[]) => void }) {
  const [a, setA] = useState<(Answer | undefined)[]>([]);
  return <><h2>قائمة شروط الدخول</h2>
    <ChecklistForm items={checklistItems(settings.rules)} answers={a} setAnswers={setA} rules={settings.rules} allowNA={settings.allowNA} />
    <button className="btn" style={{ marginTop: 10 }} onClick={() => onUse(a)}>تسجيل صفقة بهذه النتيجة</button>
    <div className="card" style={{ marginTop: 10 }}><b>قواعد ثابتة</b>
      <div className="k">• بعد {settings.rules.consecutiveLossStop} خسائر متتالية: توقف لبقية اليوم.</div><div className="k">• لا توسّع وقف الخسارة بعد الدخول.</div><div className="k">• راجع السجل أسبوعيًا واكتب أكثر خطأ تكرر.</div></div>
    <p className="k">النتيجة تُحفظ داخل الصفقة وقت حفظها، فلا تتغير لاحقًا إذا عدّلت القواعد.</p></>;
}
