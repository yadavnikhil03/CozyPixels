import { useState } from 'react';
import { motion } from 'motion/react';
import { LuArrowUpRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';

const SocialCard = ({
  className,
  image,
  title,
  name,
  pitch,
  icon,
  buttons = [],
}) => {
  const [isHovered, setHovered] = useState(false);

  return (
    <motion.article
      className={cn('social-card social-card-motion', className)}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="social-card-motion-top">
        <div className="social-card-motion-header">
          <div className="social-card-icon">{icon}</div>
          <div className="social-card-motion-title-wrap">
            <h3 className="social-card-name">{title}</h3>
            <div className="social-card-motion-rule" />
          </div>
        </div>

        {isHovered && (
          <>
            <motion.img
              src={image}
              alt={title}
              className="social-card-motion-thumb"
              width={500}
              height={500}
              layoutId="card-image"
              transition={{ duration: 0.3, ease: 'circIn' }}
            />

            <motion.div
              className="social-card-motion-dashed"
              initial={{ opacity: 0, scale: 1.6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.35, duration: 0.15, ease: 'circIn' }}
            />
          </>
        )}
      </div>

      <div className="social-card-motion-center">
        {!isHovered && (
          <>
            <motion.img
              src={image}
              alt={title}
              className="social-card-motion-main-image"
              width={500}
              height={500}
              layoutId="card-image"
              transition={{ duration: 0.3, ease: 'circIn' }}
            />
            <div className="social-card-motion-name-block">
              <h4 className="social-card-motion-name">{name}</h4>
            </div>
          </>
        )}
      </div>

      <motion.div
        className="social-card-motion-footer"
        initial={{ y: '100%' }}
        animate={{ y: isHovered ? 0 : 'calc(100% - 52px)' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="social-card-motion-footer-inner" style={{ paddingTop: isHovered ? '48px' : '16px' }}>
          <div className="social-card-motion-footer-head">
            <span>Connect with me</span>
            <LuArrowUpRight />
          </div>
          <p className="social-card-pitch">{pitch}</p>

          <div className="social-card-buttons">
            {buttons.map((button, index) => {
              const buttonContent = (
                <>
                  {button.icon && <span className="social-card-button-icon">{button.icon}</span>}
                  <span>{button.label}</span>
                </>
              );

              return button.link ? (
                <a
                  target="_blank"
                  href={button.link}
                  key={button.label ?? index}
                  className="social-card-button"
                  rel="noreferrer noopener"
                >
                  {buttonContent}
                </a>
              ) : (
                <span key={button.label ?? index} className="social-card-button">
                  {buttonContent}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
};

export default SocialCard;
