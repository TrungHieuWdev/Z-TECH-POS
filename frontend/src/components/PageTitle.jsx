export default function PageTitle({ title, description }) {
  return (
    <div className="min-w-0">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-950">
          {title}
        </h1>
      </div>

      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 sm:text-base">
        {description}
      </p>
    </div>
  );
}
