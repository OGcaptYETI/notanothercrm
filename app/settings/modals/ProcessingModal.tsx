'use client';

import React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';

interface ProcessingModalProps {
  isOpen: boolean;
  status: string;
  progress: number;
  onClose: () => void;
  showConfetti?: boolean;
}

export default function ProcessingModal({
  isOpen,
  status,
  progress,
  onClose,
  showConfetti = false
}: ProcessingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 relative overflow-hidden">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}px`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              >
                {['🎉', '💰', '✨', '🎊', '💵'][Math.floor(Math.random() * 5)]}
              </div>
            ))}
          </div>
        )}

        <div className="text-center relative z-10">
          <div className="mb-6">
            {progress < 100 ? (
              <Image 
                src="/images/kanva_logo_rotate.gif" 
                alt="Processing..." 
                width={64}
                height={64}
                className="mx-auto"
                unoptimized
              />
            ) : (
              <div className="text-6xl mb-4">💰</div>
            )}
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {progress < 100 ? 'Processing...' : 'Cha-Ching! 🎉'}
          </h3>

          <p className="text-gray-600 mb-6">{status}</p>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-primary-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <p className="text-sm font-semibold text-gray-700">{progress}%</p>

          {progress === 100 && (
            <div className="mt-6">
              <button
                onClick={onClose}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
