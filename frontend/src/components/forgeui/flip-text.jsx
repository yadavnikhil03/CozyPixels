"use client";

import React, { useMemo } from "react";
import { cn } from "../../lib/utils";

export function FlipText({
  className,
  children,
  duration = 3.5,
  delay = 0,
  loop = true,
  separator = " ",
}) {
  const words = useMemo(() => children.split(separator), [children, separator]);
  const totalChars = children.length;

  // Calculate character index for each position
  const getCharIndex = (wordIndex, charIndex) => {
      let index = 0;
      for (let i = 0; i < wordIndex; i++) {
          index += words[i].length + (separator === " " ? 1 : separator.length);
      }
      return index + charIndex;
  };

  return (
      <div
          className={cn(
              "flip-text-wrapper inline-block leading-none",
              className
          )}
          style={{ perspective: "1000px" }}
      >
          {words.map((word, wordIndex) => {
              const chars = word.split("");

              return (
                  <span
                      key={wordIndex}
                      className="word inline-block whitespace-nowrap"
                      style={{ transformStyle: "preserve-3d" }}
                  >
                      {chars.map((char, charIndex) => {
                          const currentGlobalIndex = getCharIndex(wordIndex, charIndex);

                          // Calculate delay based on character position using a sine wave for smoothness
                          const normalizedIndex = currentGlobalIndex / totalChars;
                          const sineValue = Math.sin(normalizedIndex * (Math.PI / 2));
                          const calculatedDelay = sineValue * (duration * 0.25) + delay;

                          return (

                              <span
                                  key={charIndex}
                                  className="flip-char inline-block relative"
                                  data-char={char}
                                  style={
                                      {
                                          "--flip-duration": `${duration}s`,
                                          "--flip-delay": `${calculatedDelay}s`,
                                          "--flip-iteration": loop ? "infinite" : "1",
                                          transformStyle: "preserve-3d",
                                      }
                                  }
                              >
                                  {char}
                              </span>
                          );
                      })}
                      {separator === " " && wordIndex < words.length - 1 && (
                          <span className="whitespace inline-block">&nbsp;</span>
                      )}
                      {separator !== " " && wordIndex < words.length - 1 && (
                          <span className="separator inline-block">{separator}</span>
                      )}
                  </span>
              );
          })}
      </div>
  );
}

export default FlipText;
