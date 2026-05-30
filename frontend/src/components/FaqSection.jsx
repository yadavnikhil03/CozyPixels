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
    <section className="w-full max-w-4xl mx-auto py-16 px-6">
      {/* Invisible Schema Markup for Google SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />

      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-semibold mb-4 text-[var(--md-sys-color-on-background)]">Frequently Asked Questions</h2>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          Everything you need to know about setting up the perfect aesthetic workspace, finding cute wallpapers, and managing your device backgrounds.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div 
              key={index} 
              className="bg-[var(--md-sys-color-surface-container)] rounded-2xl overflow-hidden transition-all duration-300 border border-[var(--md-sys-color-outline-variant)]"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
              >
                <span className="font-medium text-[var(--md-sys-color-on-surface)] pr-4">{faq.question}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="text-[var(--md-sys-color-on-surface-variant)] flex-shrink-0"
                >
                  <LuChevronDown size={20} />
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
                    <div className="px-6 pb-6 text-[var(--md-sys-color-on-surface-variant)] text-sm md:text-base leading-relaxed">
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
