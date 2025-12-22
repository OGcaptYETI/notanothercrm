import Image from 'next/image';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

export default function Loading({ 
  size = 'md', 
  text,
  fullScreen = false 
}: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={sizeMap[size]}>
        <Image
          src="/images/kanva_logo_rotate.gif"
          alt="Loading..."
          width={size === 'sm' ? 64 : size === 'md' ? 128 : size === 'lg' ? 192 : 256}
          height={size === 'sm' ? 64 : size === 'md' ? 128 : size === 'lg' ? 192 : 256}
          className="mx-auto"
          priority
          unoptimized
        />
      </div>
      {text && (
        <p className="text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
