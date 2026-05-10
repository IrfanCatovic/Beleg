type Props = {
  className?: string;
  flip?: boolean;
};

export default function MountainDivider({ className, flip }: Props) {
  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none w-full overflow-hidden leading-[0]",
        flip ? "rotate-180" : "",
        className ?? "",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        className="block w-full h-12 sm:h-16 text-current"
      >
        <path
          fill="currentColor"
          d="M0 80 L80 50 L180 65 L280 30 L380 60 L500 25 L620 60 L760 35 L880 60 L1010 30 L1120 55 L1200 40 L1200 80 Z"
        />
      </svg>
    </div>
  );
}
