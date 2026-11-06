"use client";

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { INVENTORY, INVENTORY_NOTICE } from '../data/catalogue';
import { searchCatalogue, type SearchRequest } from '../lib/catalogueSearch';
import { parseDemoInput, type DemoNluResult } from '../lib/demoNlu';
import { advancePropertyDisclosure, beginPropertyDisclosure, type PropertyDisclosureState } from '../lib/propertyDisclosure';
import { answerPropertyFollowUp, beginPropertyFollowUp, getPropertyFollowUpPrompt, type PropertyFollowUpState, type RejectionRecord } from '../lib/propertyFollowUp';
import { answerQualification, beginQualification, type QualificationLanguage, type QualificationState } from '../lib/qualification';

const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface DemoMessage {
  readonly id: number;
  readonly role: 'assistant' | 'user';
  readonly text: string;
  readonly photos?: readonly { src: string; alt: string; synthetic: true }[];
}
interface DemoReply { readonly id: string; readonly label: string }
type DemoStage = 'qualification' | 'disclosure' | 'follow-up' | 'done';

function searchRequestFrom(state: QualificationState): SearchRequest | null {
  const { location, budgetMaxEgp, minAreaSqm } = state.answers;
  if (!location || budgetMaxEgp === undefined || minAreaSqm === undefined) return null;
  return {
    cityId: location.cityId,
    ...(location.districtId ? { districtId: location.districtId } : {}),
    ...(location.communityId ? { communityId: location.communityId } : {}),
    maxBudgetEgp: budgetMaxEgp,
    minAreaSqm,
    allowRelaxation: false,
  };
}

function isAction<K extends DemoNluResult['kind']>(
  result: DemoNluResult,
  kind: K,
): result is Extract<DemoNluResult, { kind: K }> {
  return result.kind === kind;
}

export function InteractiveDemo({ language }: { language: QualificationLanguage }) {
  const ar = language === 'ar';
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState<DemoStage>('qualification');
  const [qualification, setQualification] = useState<QualificationState | null>(null);
  const [disclosure, setDisclosure] = useState<PropertyDisclosureState | null>(null);
  const [followUp, setFollowUp] = useState<PropertyFollowUpState | null>(null);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [shownIds, setShownIds] = useState<readonly string[]>([]);
  const [rejections, setRejections] = useState<readonly RejectionRecord[]>([]);
  const [messages, setMessages] = useState<readonly DemoMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  const append = (role: DemoMessage['role'], text: string, photos?: DemoMessage['photos']) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { id, role, text, ...(photos ? { photos } : {}) }]);
  };

  const start = () => {
    const initial = beginQualification(language);
    setStarted(true);
    setStage('qualification');
    setQualification(initial.state);
    setDisclosure(null);
    setFollowUp(null);
    setSearchRequest(null);
    setShownIds([]);
    setRejections([]);
    setNotice(null);
    setMessages([{ id: nextId.current++, role: 'assistant', text: initial.prompt.text }]);
  };

  const reset = () => {
    setStarted(false);
    setStage('qualification');
    setQualification(null);
    setDisclosure(null);
    setFollowUp(null);
    setSearchRequest(null);
    setShownIds([]);
    setRejections([]);
    setMessages([]);
    setDraft('');
    setNotice(null);
  };

  const clarificationText = (result: DemoNluResult) => result.kind === 'clarification' ? result.text : '';

  const submit = (text: string, quickReplyId?: string) => {
    const value = text.trim();
    if (!value || stage === 'done') return;
    append('user', value);
    setDraft('');
    setNotice(null);

    if (stage === 'qualification' && qualification) {
      const parsed = parseDemoInput({ text: value, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'qualification', state: qualification });
      if (!isAction(parsed, 'qualification')) {
        append('assistant', clarificationText(parsed));
        return;
      }
      const step = answerQualification(qualification, parsed.input);
      setQualification(step.state);
      if (step.prompt.question !== null) {
        append('assistant', step.prompt.text);
        return;
      }
      const request = searchRequestFrom(step.state);
      if (!request) {
        append('assistant', ar ? 'محتاج أتأكد من المدينة والميزانية والمساحة قبل البحث.' : 'I need the city, budget, and area before I can search.');
        return;
      }
      const result = searchCatalogue(request);
      if (!result.bestMatch) {
        append('assistant', ar
          ? 'ملقتش اختيار تجريبي مطابق لتفضيلاتك الحالية، ومش هغيّر شروطك من غير ما أسألك.'
          : 'I couldn’t find an illustrative match under those preferences, and I won’t change your criteria without asking.');
        setStage('done');
        return;
      }
      const property = result.bestMatch;
      setSearchRequest(request);
      setShownIds([property.id]);
      append('assistant', ar
        ? `أقرب اختيار تجريبي واحد هو ${property.title.ar}. ${INVENTORY_NOTICE.ar}`
        : `The closest illustrative match is ${property.title.en}. ${INVENTORY_NOTICE.en}`);
      const firstDisclosure = beginPropertyDisclosure(property.id, language);
      setDisclosure(firstDisclosure.state);
      setStage('disclosure');
      append('assistant', firstDisclosure.prompt.text);
      return;
    }

    if (stage === 'disclosure' && disclosure) {
      const parsed = parseDemoInput({ text: value, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'disclosure', state: disclosure });
      if (!isAction(parsed, 'disclosure')) {
        append('assistant', clarificationText(parsed));
        return;
      }
      const step = advancePropertyDisclosure(disclosure, parsed.action);
      setDisclosure(step.state);
      append('assistant', step.prompt.text);
      if (step.state.phase === 'complete' && searchRequest) {
        const nextFollowUp = beginPropertyFollowUp(
          step.state.propertyId,
          searchRequest,
          language,
          shownIds,
          rejections,
        );
        setFollowUp(nextFollowUp.state);
        setStage('follow-up');
        append('assistant', nextFollowUp.prompt.text);
      }
      return;
    }

    if (stage === 'follow-up' && followUp) {
      const parsed = parseDemoInput({ text: value, ...(quickReplyId ? { quickReplyId } : {}) }, { kind: 'follow-up', state: followUp });
      if (!isAction(parsed, 'follow-up')) {
        append('assistant', clarificationText(parsed));
        return;
      }
      const step = answerPropertyFollowUp(followUp, parsed.action);
      setFollowUp(step.state);
      append('assistant', step.prompt.text, step.prompt.photos);
      if (step.prompt.kind === 'photos') return;
      if (step.state.phase === 'alternative-ready' && step.prompt.nextPropertyId && searchRequest) {
        setShownIds(step.state.shownPropertyIds);
        setRejections(step.state.rejections);
        const property = INVENTORY.find((item) => item.id === step.prompt.nextPropertyId);
        if (!property) {
          setNotice(ar ? 'لم أتمكن من فتح الاختيار التجريبي التالي.' : 'I could not open the next illustrative match.');
          setStage('done');
          return;
        }
        append('assistant', ar
          ? `اختيار تجريبي آخر: ${property.title.ar}. ${INVENTORY_NOTICE.ar}`
          : `One other illustrative match: ${property.title.en}. ${INVENTORY_NOTICE.en}`);
        const nextDisclosure = beginPropertyDisclosure(property.id, language);
        setDisclosure(nextDisclosure.state);
        setStage('disclosure');
        append('assistant', nextDisclosure.prompt.text);
        return;
      }
      if (step.state.phase === 'confirmed' || step.state.phase === 'no-alternative') setStage('done');
    }
  };

  const quickReplies: readonly DemoReply[] = !started
    ? []
    : stage === 'qualification' && qualification
      ? answerQualification(qualification, {}).prompt.quickReplies.map((reply) => ({ id: reply.id, label: reply.label }))
      : stage === 'disclosure' && disclosure
        ? disclosure.phase === 'location' || disclosure.phase === 'price'
          ? [{ id: `continue-${disclosure.phase}`, label: ar ? 'أيوه، كمل' : 'Yes, continue' }]
          : disclosure.phase === 'area'
            ? [{ id: 'cash', label: ar ? 'كاش' : 'Cash' }, { id: 'installments', label: ar ? 'تقسيط' : 'Installments' }]
            : []
        : stage === 'follow-up' && followUp
          ? getPropertyFollowUpPrompt(followUp).quickReplies.map((reply) => ({ id: reply.id, label: reply.label }))
          : [];

  const placeholder = stage === 'qualification'
    ? ar ? 'اكتب المدينة أو الميزانية أو المساحة…' : 'Type a city, budget, or area…'
    : stage === 'disclosure'
      ? ar ? 'اكتب نعم، كاش، أو تقسيط…' : 'Type yes, cash, or installments…'
      : ar ? 'اكتب تأكيد، استكشاف، سبب، أو صور…' : 'Type confirm, explore, a reason, or photos…';

  return (
    <section aria-label={ar ? 'المحادثة التجريبية التفاعلية' : 'Interactive no-key demo'} dir={ar ? 'rtl' : 'ltr'} style={{ margin: '8px 12px 12px', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-md, 12px)', background: 'var(--color-paper)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 750 }}>{ar ? 'تجربة تفاعلية بدون مفتاح API' : 'Interactive demo · no API key'}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-meta)' }}>{ar ? 'بدون طلبات API أو استخدام نموذج ذكاء اصطناعي؛ البيانات والعقارات والصور تجريبية.' : 'No API or AI calls; listings, payment terms, and photos are synthetic.'}</p>
        </div>
        {!started ? (
          <button type="button" onClick={start} style={buttonStyle(true)}>{ar ? 'ابدأ المحادثة التجريبية' : 'Start interactive demo'}</button>
        ) : (
          <button type="button" onClick={reset} style={buttonStyle(false)}>{ar ? 'إعادة البدء' : 'Start over'}</button>
        )}
      </div>
      {started ? (
        <>
          <div role="log" tabIndex={0} aria-label={ar ? 'سجل رسائل التجربة' : 'Demo conversation messages'} aria-live="polite" aria-relevant="additions text" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            {messages.map((message) => (
              <div key={message.id} style={{ alignSelf: message.role === 'user' ? (ar ? 'flex-start' : 'flex-end') : (ar ? 'flex-end' : 'flex-start'), maxWidth: '92%', padding: '9px 11px', borderRadius: '12px', background: message.role === 'user' ? 'var(--color-accent)' : 'var(--color-slate)', color: message.role === 'user' ? 'var(--color-accent-contrast)' : 'var(--text-primary)', fontSize: '12px', lineHeight: 1.55 }}>
                  <div>{message.text}</div>
                  {message.photos?.map((photo) => (
                    <figure key={photo.src} style={{ margin: '8px 0 0' }}>
                      <Image src={`${PUBLIC_BASE_PATH}${photo.src}`} alt={photo.alt} width={600} height={448} unoptimized sizes="(max-width: 640px) 85vw, 280px" style={{ display: 'block', maxWidth: '100%', width: '280px', height: 'auto', borderRadius: '8px' }} />
                      <figcaption style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-meta)' }}>{ar ? 'صورة تجريبية توضيحية' : 'Synthetic demo image'}</figcaption>
                    </figure>
                  ))}
                </div>
            ))}
            {notice ? <div role="status" style={{ color: 'var(--text-meta)', fontSize: '12px' }}>{notice}</div> : null}
            <div ref={endRef} />
          </div>
          {quickReplies.length ? (
            <div aria-label={ar ? 'اختيارات سريعة' : 'Quick replies'} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 12px 10px' }}>
              {quickReplies.map((reply) => (
                <button key={reply.id} type="button" onClick={() => submit(reply.label, reply.id)} style={buttonStyle(false)}>{reply.label}</button>
              ))}
            </div>
          ) : null}
          {stage !== 'done' ? (
            <form onSubmit={(event) => { event.preventDefault(); submit(draft); }} style={{ display: 'flex', gap: '8px', padding: '0 12px 12px' }}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} autoComplete="off" aria-label={ar ? 'اكتب ردك' : 'Write your demo reply'} placeholder={placeholder} style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm, 8px)', background: 'var(--color-paper)', color: 'var(--text-primary)', fontSize: '12px' }} />
              <button type="submit" disabled={!draft.trim()} style={buttonStyle(true)}>{ar ? 'إرسال' : 'Send'}</button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function buttonStyle(primary: boolean): CSSProperties {
  return {
    minHeight: '36px', padding: '7px 12px', borderRadius: '999px',
    border: primary ? '1px solid transparent' : '1px solid var(--border-med)',
    background: primary ? 'var(--color-accent)' : 'var(--color-slate)',
    color: primary ? 'var(--color-accent-contrast)' : 'var(--text-primary)',
    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
  };
}
