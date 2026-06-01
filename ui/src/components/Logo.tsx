import scaifyLogo from './Scaify.png';

type LogoProps = {
  className?: string;
};

/** Logo chính thức — `Scaify.png` */
export default function Logo({ className = 'h-10 w-auto max-w-[200px]' }: LogoProps) {
  return (
    <img
      src={scaifyLogo}
      alt="Scaify — Đối soát & Kiểm soát thuế TMĐT"
      className={`object-contain object-center ${className}`}
      width={280}
      height={120}
      decoding="async"
    />
  );
}
