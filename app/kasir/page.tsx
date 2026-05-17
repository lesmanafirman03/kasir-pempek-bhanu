"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useCartStore } from '@/store/useCartStore'
import { 
  ShoppingCart, User, Ticket, Trash2, 
  Loader2, Utensils, LayoutDashboard, ClipboardList, 
  Plus, FileSpreadsheet, RefreshCcw, Award
} from 'lucide-react'
import * as XLSX from 'xlsx'

export default function CashierDashboard() {
  // Navigasi Tab Menu Utama
  const [activeTab, setActiveTab] = useState<'kasir' | 'menu' | 'laporan'>('kasir')

  // State Utama Data
  const [menus, setMenus] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // State Form Transaksi Kasir
  const [customerName, setCustomerName] = useState('')
  const [queueNum, setQueueNum] = useState<number>(1) 
  const [loadingQueue, setLoadingQueue] = useState(true) 
  const [orderType, setOrderType] = useState('Makan di tempat')
  const { items, addItem, removeItem, clearCart, getTotal } = useCartStore()

  // State Baru: Menyimpan data struk dari transaksi yang baru saja berhasil disimpan
  const [transaksiTerakhir, setTransaksiTerakhir] = useState<any>(null)

  // State Form Manajemen Menu
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuPrice, setNewMenuPrice] = useState('')

  useEffect(() => {
    fetchMenus()
    fetchTransactions()
    fetchNextQueueNumber() 
  }, [])

  // Fungsi mengambil nomor antrian otomatis selanjutnya dari RPC Supabase
  const fetchNextQueueNumber = async () => {
    setLoadingQueue(true)
    try {
      const { data, error } = await supabase.rpc('get_next_queue_number')
      if (error) throw error
      setQueueNum(data || 1)
    } catch (error: any) {
      console.error('Gagal mengambil nomor antrian:', error.message)
    } finally {
      setLoadingQueue(false)
    }
  }

  const fetchMenus = async () => {
    const { data, error } = await supabase
      .from('produk')
      .select('*')
      .order('nama', { ascending: true })
    if (data) setMenus(data)
  }

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transaksi')
      .select('*')
      .order('dibuat_at', { ascending: false })
    if (data) setTransactions(data)
  }

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMenuName || !newMenuPrice) return

    const { error } = await supabase
      .from('produk')
      .insert([{ nama: newMenuName, harga: parseInt(newMenuPrice), kategori: 'Menu Lain' }])

    if (error) {
      alert('Gagal menambah menu: ' + error.message)
    } else {
      alert('✅ Menu baru berhasil ditambahkan!')
      setNewMenuName('')
      setNewMenuPrice('')
      fetchMenus()
    }
  }

  const handleDeleteMenu = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini dari daftar?')) return

    const { error } = await supabase
      .from('produk')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus menu: ' + error.message)
    } else {
      fetchMenus()
    }
  }

  const handleCheckout = async () => {
    if (!customerName || loadingQueue || items.length === 0) {
      alert("⚠️ Mohon lengkapi Nama Pelanggan dan pilih Menu terlebih dahulu!")
      return
    }
    setIsLoading(true)
    try {
      const orderItemsSummary = items.map((item: any) => ({
        id: item.id,
        nama: item.nama || item.name, 
        qty: item.qty,
        harga: item.harga || item.price,
        subtotal: (item.harga || item.price) * item.qty
      }))

      const { data: insertedData, error: trxErr } = await supabase
        .from('transaksi')
        .insert([{
          nama_pelanggan: customerName,
          nomor_antrean: queueNum, 
          tipe_pesanan: orderType,
          total_pembayaran: getTotal(),
          item_pesanan: orderItemsSummary,
          status_pembayaran: 'LUNAS',
          metode_pembayaran: 'TUNAI'
        }])
        .select()
        .single()

      if (trxErr) throw trxErr

      // Simpan data transaksi ke state agar komponen struk ter-render HTML-nya
      setTransaksiTerakhir(insertedData)

      // PERBAIKAN UTAMA: Memaksa browser me-load gambar logo sampai selesai sebelum cetak dimulai
      const img = new Image()
      img.src = "/logo-bhanu.png"
      img.onload = () => {
        // Jalankan cetak hanya ketika gambar terbukti sudah selesai di-load 100% oleh browser
        setTimeout(() => {
          window.print()
        }, 300)
      }
      img.onerror = () => {
        // Jika gambar gagal di-load (opsi cadangan agar aplikasi tidak macet)
        console.error("Gagal memuat logo struk, mencetak tanpa logo...")
        setTimeout(() => {
          window.print()
        }, 300)
      }
      
      clearCart()
      setCustomerName('')
      
      await fetchNextQueueNumber()
      fetchTransactions()
    } catch (error: any) {
      alert('❌ Terjadi kesalahan: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetLaporan = async () => {
    if (!confirm('⚠️ PERINGATAN! Anda akan menghapus seluruh data riwayat transaksi secara permanen. Lanjutkan?')) return

    setIsLoading(true)
    const { error } = await supabase.from('transaksi').delete().neq('id', 0)

    setIsLoading(false)
    if (error) {
      alert('Gagal mengosongkan laporan: ' + error.message)
    } else {
      alert('✅ Seluruh laporan riwayat transaksi berhasil di-reset bersih!')
      fetchTransactions()
      await fetchNextQueueNumber() 
    }
  }

  const exportToExcel = () => {
    if (transactions.length === 0) {
      alert('Belum ada data transaksi yang bisa diekspor.')
      return
    }

    const formatDataExcel = transactions.map((t, index) => ({
      'No': index + 1,
      'Tanggal & Waktu': new Date(t.dibuat_at).toLocaleString('id-ID'),
      'Nama Pelanggan': t.nama_pelanggan,
      'No Antrian': String(t.nomor_antrean).padStart(3, '0'), 
      'Tipe Pesanan': t.tipe_pesanan,
      'Total Bayar': t.total_pembayaran
    }))

    const worksheet = XLSX.utils.json_to_sheet(formatDataExcel)
    const workbook = XLSX.utils.book_new()
    XXLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kasir')
    XXLSX.writeFile(workbook, `Laporan_Pempek_Bhanu_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-screen bg-slate-100 font-sans text-slate-800 lg:overflow-hidden">
      
      {/* --- SIDEBAR KIRI --- */}
      <div className="w-full lg:w-64 bg-[#0F4C92] text-white flex flex-col justify-between p-4 lg:p-5 shadow-2xl relative z-10 print:hidden">
        <div className="space-y-4 lg:space-y-6">
          
          <div className="bg-[#FFED00] rounded-xl p-4 shadow-inner text-center border-2 border-white overflow-hidden relative group">
            <div className="absolute top-1 right-2 flex items-center gap-0.5 text-[8px] text-red-700 font-black">
              <Award size={10} className="text-red-600 animate-bounce" /> HALAL
            </div>
            <h1 className="text-xl font-black text-[#0F4C92] tracking-tighter leading-none m-0">PEMPEK</h1>
            <h2 className="text-3xl font-black text-[#E30613] tracking-normal leading-tight mt-0.5 drop-shadow-sm">BHANU</h2>
            
            <div className="bg-[#0F4C92] text-white text-[9px] sm:text-[10px] font-black py-1 px-2 mt-2 rounded uppercase tracking-wider flex flex-col items-center justify-center text-center leading-normal whitespace-normal break-words">
              <span>Asli Palembang Nian,</span>
              <span>100% Ikan Tenggiri Super</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-300 font-bold tracking-widest uppercase text-center px-2 bg-[#0a386d] py-1.5 rounded-lg border border-blue-800">
            📍 Cluster Canggu Blok D05/19 Jl. Canggu II Citra Maja City
          </p>

          <nav className="grid grid-cols-3 lg:flex lg:flex-col gap-2 lg:space-y-1.5">
            <button 
              onClick={() => setActiveTab('kasir')}
              className={`flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-wider transition-all ${activeTab === 'kasir' ? 'bg-[#FFED00] text-[#0F4C92] shadow-lg scale-[1.02]' : 'hover:bg-[#145fa7] text-white'}`}
            >
              <Utensils size={14} className="lg:w-4 lg:h-4" /> <span className="truncate">Kasir Order</span>
            </button>
            <button 
              onClick={() => setActiveTab('menu')}
              className={`flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-wider transition-all ${activeTab === 'menu' ? 'bg-[#FFED00] text-[#0F4C92] shadow-lg scale-[1.02]' : 'hover:bg-[#145fa7] text-white'}`}
            >
              <LayoutDashboard size={14} className="lg:w-4 lg:h-4" /> <span className="truncate">Kelola Menu</span>
            </button>
            <button 
              onClick={() => setActiveTab('laporan')}
              className={`flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-wider transition-all ${activeTab === 'laporan' ? 'bg-[#FFED00] text-[#0F4C92] shadow-lg scale-[1.02]' : 'hover:bg-[#145fa7] text-white'}`}
            >
              <ClipboardList size={14} className="lg:w-4 lg:h-4" /> <span className="truncate">Lap. Omset</span>
            </button>
          </nav>
        </div>

        <div className="hidden lg:flex text-[10px] text-slate-300 border-t border-blue-800 pt-4 font-bold items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          Database Supabase Active
        </div>
      </div>

      {/* --- PANEL UTAMA --- */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto lg:overflow-hidden print:hidden">
        
        {/* TAB 1: KASIR */}
        {activeTab === 'kasir' && (
          <div className="flex flex-col lg:flex-row h-full w-full overflow-y-auto lg:overflow-hidden">
            <div className="w-full lg:w-2/3 p-4 lg:p-6 flex flex-col h-auto lg:h-full">
              <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-l-4 border-[#0F4C92]">
                <h2 className="text-xs lg:text-sm font-black text-[#0F4C92] tracking-wide uppercase">Daftar Menu</h2>
                <span className="text-[10px] lg:text-[11px] font-black bg-blue-50 text-[#0F4C92] px-3 py-1 rounded-md border border-blue-100">{menus.length} Produk</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4 overflow-y-auto pb-6 lg:pb-10 max-h-[50vh] lg:max-h-none">
                {menus.length === 0 ? (
                  <div className="col-span-3 flex flex-col items-center justify-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Loader2 className="animate-spin text-[#0F4C92] mb-2" size={24} />
                    <p className="text-slate-400 font-bold text-[11px] italic">Menghubungkan data menu Supabase...</p>
                  </div>
                ) : (
                  menus.map(menu => (
                    <button key={menu.id} onClick={() => addItem({ ...menu, name: menu.nama, price: menu.harga })} className="bg-white p-3 lg:p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-[#0F4C92] transition-all text-left flex flex-col justify-between h-28 lg:h-32 active:scale-95 group relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-12 h-12 lg:w-16 lg:h-16 bg-slate-50 rounded-bl-full group-hover:bg-blue-50 transition-colors z-0"></div>
                      <div className="font-black text-xs lg:text-sm text-slate-700 uppercase group-hover:text-[#0F4C92] transition-colors relative z-10 max-w-[85%] truncate lg:whitespace-normal">{menu.nama}</div>
                      <div className="flex justify-between items-center w-full relative z-10">
                        <span className="text-sm lg:text-base font-black text-[#0F4C92]">Rp {menu.harga.toLocaleString('id-ID')}</span>
                        <span className="w-7 h-7 lg:w-8 lg:h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-base lg:text-lg group-hover:bg-[#FFED00] group-hover:text-[#0F4C92] group-hover:shadow transition-all">+</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Sisi Kanan: Checkout Form */}
            <div className="w-full lg:w-1/3 bg-white shadow-xl flex flex-col h-auto lg:h-full border-t lg:border-t-0 lg:border-l border-slate-200">
              <div className="p-4 lg:p-5 bg-slate-50 border-b border-slate-200">
                <h3 className="font-black text-[#0F4C92] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShoppingCart size={14} className="text-[#E30613]"/> Input Pesanan Baru
                </h3>
                <div className="space-y-2.5">
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input type="text" placeholder="Nama Pelanggan" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:outline-[#0F4C92]" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  
                  <div className="relative">
                    <Ticket size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-black text-xs text-slate-600 cursor-not-allowed" 
                      value={loadingQueue ? "Menghitung..." : String(queueNum).padStart(3, '0')} 
                      readOnly 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setOrderType('Makan di tempat')} className={`py-2 rounded-xl text-[10px] lg:text-[11px] font-black uppercase tracking-wider transition-all ${orderType === 'Makan di tempat' ? 'bg-[#0F4C92] text-white shadow' : 'bg-white border text-slate-400'}`}>Ditempat</button>
                    <button onClick={() => setOrderType('Dibungkus')} className={`py-2 rounded-xl text-[10px] lg:text-[11px] font-black uppercase tracking-wider transition-all ${orderType === 'Dibungkus' ? 'bg-[#0F4C92] text-white shadow' : 'bg-white border text-slate-400'}`}>Bungkus</button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 min-h-[150px] lg:min-h-0">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-6">
                    <ShoppingCart size={32} strokeWidth={1.5} />
                    <p className="text-[10px] font-bold mt-1 uppercase tracking-wider">Belum Ada Item</p>
                  </div>
                ) : items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <h5 className="font-black text-xs text-slate-700 uppercase">{item.nama || item.name}</h5>
                      <span className="text-[10px] text-slate-400 font-bold">{item.qty} x Rp {(item.harga || item.price).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-[#0F4C92]">Rp {((item.harga || item.price) * item.qty).toLocaleString('id-ID')}</span>
                      <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-[#E30613] transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 lg:p-5 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Pembayaran</span>
                  <span className="text-lg lg:text-xl font-black text-[#E30613]">Rp {getTotal().toLocaleString('id-ID')}</span>
                </div>
                <button onClick={handleCheckout} disabled={isLoading || loadingQueue} className="w-full bg-[#0F4C92] text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#145fa7] active:scale-[0.99] transition-all disabled:bg-slate-200 disabled:text-slate-400">
                  {isLoading ? 'SEDANG MEMPROSES...' : 'CETAK & SIMPAN NOTA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGEMENT PRODUK */}
        {activeTab === 'menu' && (
          <div className="p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 h-full overflow-y-auto lg:overflow-hidden">
            <div className="w-full lg:w-1/3 bg-white p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h3 className="font-black text-xs uppercase tracking-wider text-[#0F4C92] mb-3 flex items-center gap-2"><Plus size={14} className="text-[#E30613]"/> Tambah Variasi Baru</h3>
              <form onSubmit={handleAddMenu} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nama Menu</label>
                  <input type="text" placeholder="Contoh: Pempek Lenjer Besar" className="w-full px-3 py-2 border rounded-xl font-bold text-xs focus:outline-[#0F4C92]" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Harga Satuan (Rp)</label>
                  <input type="number" placeholder="Contoh: 15000" className="w-full px-3 py-2 border rounded-xl font-bold text-xs focus:outline-[#0F4C92]" value={newMenuPrice} onChange={e => setNewMenuPrice(e.target.value)} required />
                </div>
                <button type="submit" className="w-full bg-[#0F4C92] text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#145fa7] transition-all">Simpan Menu</button>
              </form>
            </div>

            <div className="w-full lg:w-2/3 bg-white p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-auto lg:h-full overflow-hidden">
              <h3 className="font-black text-xs uppercase tracking-wider text-[#0F4C92] mb-3">Daftar Harga Menu Terdaftar</h3>
              <div className="flex-1 overflow-x-auto lg:overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b text-[10px] font-black text-slate-400 uppercase bg-slate-50"><th className="p-3">Nama Menu</th><th className="p-3">Harga Jual</th><th className="p-3 text-center">Tindakan</th></tr>
                  </thead>
                  <tbody>
                    {menus.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-8 text-xs italic text-slate-400">Belum ada varian menu.</td></tr>
                    ) : (
                      menus.map(menu => (
                        <tr key={menu.id} className="border-b hover:bg-slate-50 text-xs font-bold text-slate-600">
                          <td className="p-3 uppercase text-slate-800">{menu.nama}</td>
                          <td className="p-3 text-[#0F4C92] font-black text-sm">Rp {menu.harga.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => handleDeleteMenu(menu.id)} className="text-slate-300 hover:text-[#E30613] p-1.5 rounded-lg hover:bg-red-50 transition-all"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LAPORAN */}
        {activeTab === 'laporan' && (
          <div className="p-4 lg:p-6 flex flex-col h-full overflow-y-auto lg:overflow-hidden gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 lg:p-5 rounded-2xl shadow-sm border-l-4 border-[#FFED00] gap-3">
              <div>
                <h3 className="font-black text-xs uppercase tracking-wider text-[#0F4C92]">Dashboard Omset Penjualan</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Total Pendapatan: <span className="font-black text-[#E30613] text-sm lg:text-base">Rp {transactions.reduce((sum, t) => sum + (t.total_pembayaran || t.total_amount || 0), 0).toLocaleString('id-ID')}</span> ({transactions.length} Nota)</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={exportToExcel} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-wider transition-all"><FileSpreadsheet size={14}/> Export</button>
                <button onClick={handleResetLaporan} disabled={isLoading} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-[#E30613] hover:bg-red-700 text-white px-3 py-2 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-wider transition-all"><RefreshCcw size={14}/> Reset</button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex-1 overflow-x-auto lg:overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b text-[10px] font-black text-slate-400 uppercase bg-slate-50"><th className="p-3">Waktu Nota</th><th className="p-3">Pelanggan</th><th className="p-3">Antrian</th><th className="p-3">Sajian</th><th className="p-3">Jumlah Bayar</th></tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-xs text-slate-400 font-bold italic">Belum ada riwayat penjualan terdokumentasi.</td></tr>
                    ) : (
                      transactions.map(t => (
                        <tr key={t.id} className="border-b hover:bg-slate-50 text-xs font-bold text-slate-600">
                          <td className="p-3 text-slate-400 font-medium">{new Date(t.dibuat_at).toLocaleString('id-ID')}</td>
                          <td className="p-3 uppercase text-slate-800">{t.nama_pelanggan}</td>
                          <td className="p-3 text-[#0F4C92]">#{String(t.nomor_antrean).padStart(3, '0')}</td> 
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black ${t.tipe_pesanan === 'Makan di tempat' ? 'bg-blue-50 text-[#0F4C92]' : 'bg-red-50 text-[#E30613]'}`}>{t.tipe_pesanan}</span></td>
                          <td className="p-3 text-[#0F4C92] font-black text-sm">Rp {(t.total_pembayaran || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- STRUK AREA (HANYA MUNCUL SAAT DI-PRINT / WINDOW.PRINT()) --- */}
      {transaksiTerakhir && (
        <div id="struk-pembayaran" className="hidden print:block font-mono text-black p-0 m-0 w-[58mm] text-xs">
          {/* Header Struk */}
          <div className="text-center mb-1">
            <img 
              src="/logo-bhanu.png" 
              alt="Logo" 
              className="w-12 h-auto mx-auto mb-1 block object-contain" 
            />
            <h2 className="text-sm font-bold tracking-tight m-0 uppercase">Pempek Bhanu</h2>
            <p className="text-[9px] leading-tight m-0 mt-0.5">
              Cluster Canggu Blok D05/19<br />Jl. Canggu II Citra Maja City
            </p>
          </div>

          <div className="text-center my-1 text-[11px]">================================</div>

          {/* Metadata Transaksi */}
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between"><span>No. Nota:</span> <span>#TRX-{transaksiTerakhir.id}</span></div>
            <div className="flex justify-between"><span>Tanggal:</span> <span>{new Date(transaksiTerakhir.dibuat_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
            <div className="flex justify-between"><span>Pelanggan:</span> <span className="uppercase">{transaksiTerakhir.nama_pelanggan}</span></div>
            <div className="flex justify-between font-bold bg-gray-100 p-0.5 my-0.5">
              <span>No. Antrean:</span> <span>{String(transaksiTerakhir.nomor_antrean).padStart(3, '0')}</span>
            </div>
            <div className="flex justify-between"><span>Sajian:</span> <span className="uppercase">{transaksiTerakhir.tipe_pesanan}</span></div>
          </div>

          <div className="text-center my-1 text-[11px]">--------------------------------</div>

          {/* Daftar Menu Items */}
          <div className="space-y-1 text-[11px]">
            {transaksiTerakhir.item_pesanan && 
              (Array.isArray(transaksiTerakhir.item_pesanan) ? transaksiTerakhir.item_pesanan : JSON.parse(transaksiTerakhir.item_pesanan)).map((item: any, idx: number) => (
                <div key={idx} className="block">
                  <div className="font-bold uppercase">{item.nama}</div>
                  <div className="flex justify-between text-[10px]">
                    <span>{item.qty} x Rp {item.harga?.toLocaleString('id-ID')}</span>
                    <span>Rp {item.subtotal?.toLocaleString('id-ID')}</span>
                  </div>
                </div>
            ))}
          </div>

          <div className="text-center my-1 text-[11px]">--------------------------------</div>

          {/* Total Pembayaran */}
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL:</span> 
              <span>Rp {transaksiTerakhir.total_pembayaran?.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-[10px]"><span>Metode:</span> <span>TUNAI / LUNAS</span></div>
          </div>

          <div className="text-center my-1 text-[11px]">================================</div>

          {/* Footer Struk */}
          <div className="text-center mt-2 text-[10px] leading-tight">
            <p className="font-bold uppercase m-0">-- Terima Kasih --</p>
            <p className="m-0 mt-0.5">Selamat Menikmati Pempek Asli Palembang Kami!</p>
          </div>
        </div>
      )}

    </div>
  )
}