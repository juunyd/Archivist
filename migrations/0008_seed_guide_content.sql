-- Fills in the columns 0007 added, for the four guides that already exist in
-- `books` (confirmed live: i-lost-money-in-fno, the-revenge-trading-cure,
-- should-i-quit-trading, the-comeback-plan — all status='published',
-- price_paise=34900). Generated from lib/guides.ts + lib/site.ts's
-- homepageFaqs so the text matches the live site exactly; nothing here was
-- hand-typed.
--
-- UPDATE only, matched by slug — price_paise, pdf_path, status, currency,
-- created_at are not referenced and cannot change. If a slug doesn't exist
-- in a given database (e.g. a fresh local DB that never ran the old 0004
-- seed under these slugs), its UPDATE simply matches zero rows.

UPDATE books SET
  number = 'No. 01',
  subtitle = 'A recovery guide for Indian retail traders. How to stop the bleeding, understand what happened, and decide what comes next.',
  blurb = 'A calm, honest guide for the night after a big F&O loss — what to do, and what to skip.',
  description = 'You lost money trading F&O, and you don''t know how to get through tonight, let alone tomorrow.',
  page_count = 44,
  chapter_count = 21,
  whats_inside = '[{"title":"You are not the only one","description":"SEBI found that 93% of individual F&O traders lost money over FY22–FY24, with average losses of about ₹2 lakh — why that changes the story you tell about your own loss."},{"title":"Why losses hurt twice as much","description":"The psychology behind why a loss feels heavier than an equal gain feels good, and why that pushes you toward exactly the wrong decision."},{"title":"The cruel arithmetic of losses","description":"Why a 50% loss needs a 100% gain just to break even — and how that maths is what tempts people into the trade that finishes them off."},{"title":"The trap called \"one more trade\"","description":"The sunk-cost pull to win it back immediately, and the story of Jesse Livermore, one of history''s greatest traders, who never learned to resist it."},{"title":"Looking at what actually happened","description":"A calm, no-blame way to review your trades and real costs, so the loss becomes a page of facts instead of a cloud of shame."},{"title":"If it hurts more than money","description":"What to do, and who to call, if the loss has moved past a financial problem — including a free, 24-hour national helpline."}]',
  faqs = '[{"question":"What is an Archivist guide?","answer":"A short, focused digital guide built around one specific problem. Around 40 to 65 pages, written to be read in a single sitting."},{"question":"What format are the guides?","answer":"A print-ready PDF, delivered to your email within a minute of checkout. You can read it on a phone, laptop or tablet, or print it."},{"question":"How do I get the guide after paying?","answer":"The download link is emailed to you immediately, and also shown on the confirmation page. The link keeps working, so you can download the guide again whenever you need it."},{"question":"I didn''t receive my email. What now?","answer":"Check your spam folder first. You can also request the link again from our download page, or write to hello@archivist.in and we''ll send it to you."},{"question":"Can I get a refund?","answer":"Because the guides are delivered instantly as digital files, purchases are not refundable. If you were charged twice, or the guide was never delivered, write to hello@archivist.in and we''ll refund you in full."},{"question":"Do I get future updates of the guide?","answer":"Yes. If a guide is revised, the same download link gives you the latest edition at no extra cost."},{"question":"Who writes the guides?","answer":"Archivist is an independent Indian publisher. Each guide is researched and written in-house, with sources named in the text."}]',
  badge = '93% lose money. This is what comes next.',
  compare_at_price_paise = 49900,
  cover_path = '/images/covers/i-lost-money-in-fno.png',
  sort_order = 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'i-lost-money-in-fno';

UPDATE books SET
  number = 'No. 02',
  subtitle = 'A small book about a single, expensive habit: the trade you place to erase the last one, and the brakes that stop it.',
  blurb = 'The trade you place to erase the last loss — and the brakes that stop it before it costs you everything.',
  description = 'A loss makes you want to trade again immediately, bigger, to make it disappear. That trade is usually the expensive one.',
  page_count = 61,
  chapter_count = NULL,
  whats_inside = '[{"title":"What revenge trading actually is","description":"The exact mechanism: a loss creates urgency, urgency pushes you to size up and abandon your process — and why that trader is not the one who made your plan."},{"title":"Why losses hurt twice as much","description":"Kahneman and Tversky''s loss-aversion research, and the coefficient of 2.25 that explains why your account''s red number feels heavier than it looks."},{"title":"The hot state and the cold state","description":"Why you cannot out-think tilt in the moment, and how to write rules while calm that the panicked version of you still has to obey."},{"title":"How to catch yourself in the act","description":"Nine concrete, observable warning signs of tilt — from creeping position size to hiding trades from your family — memorised before you need them."},{"title":"Building the brake","description":"Seven tools: the pre-written rule, the kill switch, the walk-away timer, the two-loss rule, the separate account, the checklist, and the if-then plan."},{"title":"When it is bigger than a bad day","description":"How to tell an ordinary bad afternoon apart from a compulsion that needs professional help — and where to find it, including a free national helpline."}]',
  faqs = '[{"question":"What is an Archivist guide?","answer":"A short, focused digital guide built around one specific problem. Around 40 to 65 pages, written to be read in a single sitting."},{"question":"What format are the guides?","answer":"A print-ready PDF, delivered to your email within a minute of checkout. You can read it on a phone, laptop or tablet, or print it."},{"question":"How do I get the guide after paying?","answer":"The download link is emailed to you immediately, and also shown on the confirmation page. The link keeps working, so you can download the guide again whenever you need it."},{"question":"I didn''t receive my email. What now?","answer":"Check your spam folder first. You can also request the link again from our download page, or write to hello@archivist.in and we''ll send it to you."},{"question":"Can I get a refund?","answer":"Because the guides are delivered instantly as digital files, purchases are not refundable. If you were charged twice, or the guide was never delivered, write to hello@archivist.in and we''ll refund you in full."},{"question":"Do I get future updates of the guide?","answer":"Yes. If a guide is revised, the same download link gives you the latest edition at no extra cost."},{"question":"Who writes the guides?","answer":"Archivist is an independent Indian publisher. Each guide is researched and written in-house, with sources named in the text."}]',
  badge = NULL,
  compare_at_price_paise = 49900,
  cover_path = '/images/covers/the-revenge-trading-cure.png',
  sort_order = 2,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'the-revenge-trading-cure';

UPDATE books SET
  number = 'No. 03',
  subtitle = 'A set of honest questions, and a way to read your own answers. The decision stays with you.',
  blurb = 'Seven honest checkpoints to help you decide, calmly, whether to keep trading or walk away.',
  description = 'You keep asking yourself whether to quit trading, and the answer depends on your mood that day.',
  page_count = 43,
  chapter_count = NULL,
  whats_inside = '[{"title":"Why this decision is so hard","description":"The research behind sunk cost, the Concorde fallacy, and status quo bias — the forces that quietly keep people trading past the point they''d choose to."},{"title":"The seven-checkpoint test","description":"A written test covering your real trading record, your process, the true cost of continuing, and whether you''d start again today, knowing what you know now."},{"title":"A bad stretch or a bad fit","description":"How to tell a rough patch that can be waited out apart from a structural mismatch with your capital, time, temperament, or family life."},{"title":"A break is not the same as an exit","description":"Two different doors — a defined, reversible pause versus stopping for good — and rules for choosing between them written in a calm state."},{"title":"When trading stops looking like trading","description":"The signs that this has become a compulsion rather than a decision, and where to turn, including a free, 24-hour national helpline."}]',
  faqs = '[{"question":"What is an Archivist guide?","answer":"A short, focused digital guide built around one specific problem. Around 40 to 65 pages, written to be read in a single sitting."},{"question":"What format are the guides?","answer":"A print-ready PDF, delivered to your email within a minute of checkout. You can read it on a phone, laptop or tablet, or print it."},{"question":"How do I get the guide after paying?","answer":"The download link is emailed to you immediately, and also shown on the confirmation page. The link keeps working, so you can download the guide again whenever you need it."},{"question":"I didn''t receive my email. What now?","answer":"Check your spam folder first. You can also request the link again from our download page, or write to hello@archivist.in and we''ll send it to you."},{"question":"Can I get a refund?","answer":"Because the guides are delivered instantly as digital files, purchases are not refundable. If you were charged twice, or the guide was never delivered, write to hello@archivist.in and we''ll refund you in full."},{"question":"Do I get future updates of the guide?","answer":"Yes. If a guide is revised, the same download link gives you the latest edition at no extra cost."},{"question":"Who writes the guides?","answer":"Archivist is an independent Indian publisher. Each guide is researched and written in-house, with sources named in the text."}]',
  badge = NULL,
  compare_at_price_paise = 49900,
  cover_path = '/images/covers/should-i-quit-trading.png',
  sort_order = 3,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'should-i-quit-trading';

UPDATE books SET
  number = 'No. 04',
  subtitle = 'How to rebuild slowly, in a way you can check, after a loss has shaken your money, your confidence, and perhaps your home.',
  blurb = 'A staged, checkable plan for rebuilding after a loss — small size first, growth only when earned.',
  description = 'You''ve decided to keep trading. Now you need a plan that doesn''t repeat the mistake that got you here.',
  page_count = 65,
  chapter_count = NULL,
  whats_inside = '[{"title":"Small is not shameful","description":"Why trading at a small size after a loss is an instrument for cheap, useful mistakes — not a punishment, and not a step backward."},{"title":"The readiness check","description":"Seven conditions to answer honestly, in writing, before you place another trade — including whether any of the money is borrowed."},{"title":"The three-stage plan","description":"A calendar-based path from rebuilding your routine, to proving your process small, to earning the right to grow — with a gate to pass before each stage."},{"title":"The step-down rule","description":"A written trigger that shrinks your position size automatically when a drawdown starts, so the decision is made before you need to make it."},{"title":"The conversation at home","description":"How to rebuild trust with the people who watched you lose — one visible, honest week at a time, not one big promise."},{"title":"When the comeback isn''t the answer","description":"The signs that call for a pause and professional support rather than another stage of the plan, including a free national helpline."}]',
  faqs = '[{"question":"What is an Archivist guide?","answer":"A short, focused digital guide built around one specific problem. Around 40 to 65 pages, written to be read in a single sitting."},{"question":"What format are the guides?","answer":"A print-ready PDF, delivered to your email within a minute of checkout. You can read it on a phone, laptop or tablet, or print it."},{"question":"How do I get the guide after paying?","answer":"The download link is emailed to you immediately, and also shown on the confirmation page. The link keeps working, so you can download the guide again whenever you need it."},{"question":"I didn''t receive my email. What now?","answer":"Check your spam folder first. You can also request the link again from our download page, or write to hello@archivist.in and we''ll send it to you."},{"question":"Can I get a refund?","answer":"Because the guides are delivered instantly as digital files, purchases are not refundable. If you were charged twice, or the guide was never delivered, write to hello@archivist.in and we''ll refund you in full."},{"question":"Do I get future updates of the guide?","answer":"Yes. If a guide is revised, the same download link gives you the latest edition at no extra cost."},{"question":"Who writes the guides?","answer":"Archivist is an independent Indian publisher. Each guide is researched and written in-house, with sources named in the text."}]',
  badge = NULL,
  compare_at_price_paise = 49900,
  cover_path = '/images/covers/the-comeback-plan.png',
  sort_order = 4,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'the-comeback-plan';
