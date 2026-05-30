import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LuChevronDown } from 'react-icons/lu';

const faqs = [
  {
    question: "How to get animated wallpapers Windows 11?",
    answer: "To get animated or moving wallpapers on Windows 11, you typically need a third-party application like Wallpaper Engine or Lively Wallpaper. However, if you prefer a lightweight, blazing-fast native experience, the CozyPixels Desktop App is designed specifically for Windows 11 and macOS. It auto-rotates through a massive collection of high-resolution aesthetic wallpapers without draining your battery or CPU like animated wallpapers often do."
  },
  {
    question: "How to delete wallpapers on iPhone?",
    answer: "To delete wallpapers on your iPhone (iOS 16 or later): 1. Unlock your iPhone but stay on the Lock Screen. 2. Press and hold the screen until the wallpaper gallery appears. 3. Swipe left or right to find the wallpaper you want to delete. 4. Swipe UP on that wallpaper and tap the red Trash Can icon to delete it. If you're looking for fresh, cute aesthetic wallpapers or cool wallpapers to replace it, simply visit our gallery on your phone and download any image directly!"
  },
  {
    question: "How to have multiple wallpapers on iPhone?",
    answer: "You can easily have multiple wallpapers on your iPhone by using the 'Photo Shuffle' feature. Go to Settings > Wallpaper > Add New Wallpaper, and select 'Photo Shuffle'. You can choose a custom album filled with cool wallpapers, preppy wallpapers, or anime wallpapers you've downloaded from CozyPixels. Your iPhone will automatically shuffle between them every time you tap, wake, or unlock your screen."
  },
  {
    question: "How to get moving wallpapers?",
    answer: "Getting moving wallpapers requires specialized software depending on your device. For PC, apps like Lively Wallpaper are popular. On mobile, you can set Live Photos or videos as your background via TikTok or native settings. Note that moving wallpapers consume extra battery life. Many users prefer highly curated, 4K static aesthetic wallpapers (like the Catppuccin and Nord palettes we provide) for a serene workspace without the performance drop."
  },
  {
    question: "Where can I find cute aesthetic wallpapers and cool wallpapers for boys/girls?",
    answer: "Right here! CozyPixels is a completely free, open-source library containing over 900+ curated 4K wallpapers. Whether you are looking for cute wallpapers for girls, cool wallpapers for boys, minimalist anime wallpapers, or relaxing Lo-Fi scenes, our gallery covers it all. Every image is carefully color-graded to match popular themes like Catppuccin, Nord, and One Dark."
  }
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <section style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '64px 24px' }}>
      {/* Invisible Schema Markup for Google SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 className="font-display" style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '16px', color: '#1e2444', letterSpacing: '-0.04em' }}>Frequently Asked Questions</h2>
        <p style={{ color: '#626d86', maxWidth: '650px', margin: '0 auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Everything you need to know about setting up the perfect aesthetic workspace, finding cute wallpapers, and managing your device backgrounds.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div 
              key={index} 
              style={{ 
                background: 'rgba(255, 255, 255, 0.5)', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                border: '1px solid rgba(198, 197, 209, 0.4)',
                boxShadow: '0 4px 12px rgba(80, 91, 147, 0.05)'
              }}
            >
              <button
                onClick={() => toggleFaq(index)}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '20px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)'
                }}
              >
                <span style={{ fontWeight: '600', color: '#2f365e', fontSize: '1.05rem', paddingRight: '16px' }}>{faq.question}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ color: '#7a84a0', display: 'flex', flexShrink: 0 }}
                >
                  <LuChevronDown size={24} />
                </motion.div>
              </button>
              
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div style={{ padding: '0 24px 24px 24px', color: '#52607a', fontSize: '1rem', lineHeight: '1.6' }}>
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
