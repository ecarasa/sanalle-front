import { LoaderIcon } from "@/components/icons";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] size-full">
            <div className="animate-spin text-zinc-500">
                <LoaderIcon size={32} />
            </div>
            <p className="mt-4 text-sm text-zinc-500 font-medium">
                Cargando pagos...
            </p>
        </div>
    );
}
