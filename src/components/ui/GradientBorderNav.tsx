"use client";
import { useState } from "react";

import { cn } from "@/src/lib/utils";

type NavItem = {
    name: string;
    href: string;
};

interface NavProps {
    items: NavItem[];
    className?: string;
}

// ============================================================================
// 8. THE "GRADIENT BORDER" NAV (AI / Modern SaaS)
// Style: Dark, sleek, with a moving gradient border.
// Used by: OpenAI, Raycast, Linear-clones.
// ============================================================================
export const GradientBorderNav = ({ items, className }: NavProps) => {
    const [active, setActive] = useState(items[0].name);

    return (
        <div className={cn("relative p-[1px] rounded-full overflow-hidden", className)}>
            {/* Rotating Gradient Background */}
            <div className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#a855f7_100%)] animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-0 bg-zinc-900 rounded-full m-[1px]" /> {/* Inner Mask */}

            <nav className="relative z-10 flex bg-zinc-950/80 backdrop-blur-xl rounded-full px-2 py-1 border border-white/10">
                {items.map((item) => (
                    <a
                        key={item.name}
                        href={item.href}
                        onClick={(e) => { e.preventDefault(); setActive(item.name); }}
                        className={cn(
                            "px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full",
                            active === item.name
                                ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                                : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        {item.name}
                    </a>
                ))}
            </nav>
        </div>
    );
};