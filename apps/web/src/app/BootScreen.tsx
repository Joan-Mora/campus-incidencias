import { motion } from 'framer-motion';
import { BrandMark } from '../ui/BrandMark';

export function BootScreen() {
  return (
    <div className="aurora grid h-full place-items-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <BrandMark size={56} animated />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface">
          <div className="skeleton h-full w-full" />
        </div>
      </motion.div>
    </div>
  );
}
