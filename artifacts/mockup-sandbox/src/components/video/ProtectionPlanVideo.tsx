import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '../../lib/video';

const SCENE_DURATIONS = { intro: 4000, coverage: 5000, process: 5000, photos: 4500, outro: 4000 };

const COLORS = {
  primary: '#3ab549',
  navy: '#1a2332',
  blue: '#29b4d4',
  white: '#ffffff',
  red: '#ff4d4f'
};

function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ scale: 1.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div 
        className="absolute top-1/4"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <span className="text-8xl">⚠️</span>
      </motion.div>
      <motion.h1 
        className="text-5xl font-black text-white mt-12 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Damage happens.
      </motion.h1>
      <motion.h2 
        className="text-3xl font-medium mt-4"
        style={{ color: COLORS.blue }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        Don't face it alone.
      </motion.h2>
    </motion.div>
  );
}

function Scene2() {
  const items = [
    { title: "Accidental Damage", icon: "💥" },
    { title: "Liability", icon: "⚖️" },
    { title: "Partial Loss", icon: "📉" }
  ];
  
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      <h2 className="text-4xl font-bold text-white mb-16">What's Covered</h2>
      <div className="flex gap-8">
        {items.map((item, i) => (
          <motion.div 
            key={i}
            className="w-48 h-48 bg-white/10 rounded-2xl flex flex-col items-center justify-center border border-white/5"
            initial={{ scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: i * 0.3, type: "spring", bounce: 0.5 }}
          >
            <div className="text-5xl mb-4">{item.icon}</div>
            <div className="text-white font-medium text-center px-4">{item.title}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function Scene3() {
  const steps = [
    { text: "Open a Claim", color: COLORS.blue },
    { text: "We Review", color: COLORS.primary },
    { text: "Renter Charged", color: COLORS.white }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <h2 className="text-4xl font-bold text-white mb-16">How Claims Work</h2>
      <div className="flex items-center space-x-4">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <motion.div 
              className="px-8 py-4 rounded-full font-bold text-lg"
              style={{ backgroundColor: i === 2 ? COLORS.white : step.color, color: i === 2 ? COLORS.navy : COLORS.white }}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.8, type: "spring" }}
            >
              {step.text}
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div 
                className="text-white/50 text-2xl"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (i * 0.8) + 0.4 }}
              >
                ➔
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 0.8, type: "spring", damping: 20 }}
    >
      <h2 className="text-4xl font-bold text-white mb-12">Photo Documentation</h2>
      <div className="flex gap-8">
        <motion.div 
          className="relative w-64 h-80 bg-white/5 rounded-xl overflow-hidden border border-white/20 flex flex-col"
          initial={{ rotate: -10, x: -50, opacity: 0 }}
          animate={{ rotate: -5, x: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <div className="bg-green-500/20 p-2 text-center text-green-400 font-bold text-sm">BEFORE</div>
          <div className="flex-1 flex items-center justify-center text-6xl">📸</div>
        </motion.div>
        
        <motion.div 
          className="relative w-64 h-80 bg-white/5 rounded-xl overflow-hidden border border-white/20 flex flex-col"
          initial={{ rotate: 10, x: 50, opacity: 0 }}
          animate={{ rotate: 5, x: 0, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring" }}
        >
          <div className="bg-red-500/20 p-2 text-center text-red-400 font-bold text-sm">AFTER</div>
          <div className="flex-1 flex items-center justify-center text-6xl">💥</div>
        </motion.div>
      </div>
      <motion.p 
        className="text-xl text-white/70 mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        Your photos are your protection.
      </motion.p>
    </motion.div>
  );
}

function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0"
        style={{ backgroundColor: COLORS.primary }}
        initial={{ scaleY: 0, transformOrigin: "bottom" }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1, ease: "circOut" }}
      />
      <div className="relative z-10 text-center">
        <motion.h1 
          className="text-6xl font-black text-white mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Focus on adventure.
        </motion.h1>
        <motion.h2 
          className="text-4xl font-bold"
          style={{ color: COLORS.navy }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          We handle the rest.
        </motion.h2>
      </div>
    </motion.div>
  );
}

export default function ProtectionPlanVideo() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: COLORS.navy }}>
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="intro" />}
        {currentScene === 1 && <Scene2 key="coverage" />}
        {currentScene === 2 && <Scene3 key="process" />}
        {currentScene === 3 && <Scene4 key="photos" />}
        {currentScene === 4 && <Scene5 key="outro" />}
      </AnimatePresence>
    </div>
  );
}
