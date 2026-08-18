import CatalogoView from '@/components/catalogo/CatalogoView'

// Lista de precios pública accedida por token revocable (/lista/<token>).
export default function ListaPublica({ params }: { params: { token: string } }) {
  return <CatalogoView token={params.token} />
}
