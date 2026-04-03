import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '../../lib/video';

const SCENE_DURATIONS = { open: 4000, stats: 4500, steps: 5000, preview: 4500, close: 4000 };

const COLORS = {
  primary: '#3ab549',
  navy: '#1a2332',
  blue: '#29b4d4',
  white: '#ffffff',
};

// --- Scenes ---

function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at center, ${COLORS.blue}22, transparent 70%)` }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.h1 
        className="text-[6vw] font-black tracking-tighter text-white z-10"
        initial={{ y: 50, opacity: 0, rotateX: -20 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ type: "spring", bounce: 0.4, duration: 1 }}
      >
        Your Rental Business,
      </motion.h1>
      <motion.h1 
        className="text-[6vw] font-black tracking-tighter z-10"
        style={{ color: COLORS.primary }}
        initial={{ y: 50, opacity: 0, rotateX: -20 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ type: "spring", bounce: 0.4, duration: 1, delay: 0.2 }}
      >
        Elevated.
      </motion.h1>
    </motion.div>
  );
}

function Scene2() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 120 }}
    >
      <div className="w-[80%] h-[70%] bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md p-10 flex flex-col">
        <motion.h2 className="text-3xl font-bold text-white mb-8" animate={{ opacity: 1 }}>Dashboard Overview</motion.h2>
        <div className="grid grid-cols-3 gap-6 flex-1">
          {[
            { label: "Active Bookings", val: "24", color: COLORS.blue },
            { label: "Live Stats", val: "98%", color: COLORS.primary },
            { label: "Revenue", val: "$12.4k", color: COLORS.white }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              className="bg-white/10 rounded-xl p-8 flex flex-col justify-center border border-white/5"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={phase > i ? { scale: 1, opacity: 1, y: 0 } : {}}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              <div className="text-lg text-white/60 mb-2">{stat.label}</div>
              <div className="text-5xl font-black" style={{ color: stat.color }}>{stat.val}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Scene3() {
  const steps = ["Add Details", "Upload Logo", "Create Listing", "Connect Stripe", "Launch!"];
  
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.2, opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <h2 className="text-4xl font-bold text-white mb-12">Launchpad Checklist</h2>
      <div className="space-y-4 w-[400px]">
        {steps.map((step, i) => (
          <motion.div 
            key={i}
            className="flex items-center space-x-4 bg-white/10 p-4 rounded-lg"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.4, type: "spring" }}
          >
            <motion.div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: COLORS.primary, color: COLORS.navy }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: (i * 0.4) + 0.2, type: "spring", bounce: 0.6 }}
            >✓</motion.div>
            <span className="text-xl text-white font-medium">{step}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ rotateY: 90, opacity: 0, perspective: 1000 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ rotateY: -90, opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="w-[70%] h-[80%] bg-white rounded-t-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="h-12 bg-gray-100 border-b flex items-center px-4 space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="ml-4 bg-white px-4 py-1 text-sm text-gray-500 rounded-md w-1/2 shadow-sm">myoutdoorshare.com/your-brand</div>
        </div>
        <div className="flex-1 p-8 relative overflow-hidden" style={{ backgroundColor: COLORS.navy }}>
           <motion.div 
             className="absolute top-8 left-8 text-3xl font-black text-white"
             initial={{ y: -20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.5 }}
           >
             Your Brand
           </motion.div>
           <div className="mt-20 grid grid-cols-2 gap-8">
              <motion.div className="h-40 bg-white/10 rounded-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} />
              <motion.div className="h-40 bg-white/10 rounded-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} />
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ filter: "blur(20px)", opacity: 0 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="w-32 h-32 mb-8 rounded-3xl"
        style={{ backgroundColor: COLORS.primary }}
        animate={{ rotate: 360, borderRadius: ["20%", "50%", "20%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <motion.h1 
        className="text-5xl font-black text-white tracking-tight"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        You're ready.
      </motion.h1>
      <motion.h2 
        className="text-4xl font-bold mt-4"
        style={{ color: COLORS.blue }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Let's go adventure.
      </motion.h2>
    </motion.div>
  );
}

export default function GettingStartedVideo() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: COLORS.navy }}>
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="stats" />}
        {currentScene === 2 && <Scene3 key="steps" />}
        {currentScene === 3 && <Scene4 key="preview" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}
