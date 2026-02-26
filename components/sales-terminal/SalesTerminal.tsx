"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Section = {
  id: string
  name: string
  slug?: string
  departmentId: string
  hasTerminal: boolean
  isActive: boolean
}

type Department = {
  id: string
  code: string
  name: string
  type: string
}

type Product = {
  id: string
  name: string
  price: number
  sectionId: string
  sectionName: string
  departmentCode: string
}

type CartItem = {
  id: string
  productId: string
  productName: string
  basePrice: number
  quantity: number
  subtotal: number
  sectionId: string
  sectionName: string
  departmentCode: string
}

export default function SalesTerminal() {
  const router = useRouter()
  
  // State
  const [sections, setSections] = useState<Section[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'select' | 'terminal'>('select')

  // Load sections with terminals
  useEffect(() => {
    const fetchSectionsAndDepartments = async () => {
      try {
        setLoading(true)
        
        // Fetch all departments
        const deptRes = await fetch('/api/departments')
        if (deptRes.ok) {
          const deptData = await deptRes.json()
          setDepartments(deptData.data || [])
        }

        // Fetch all sections with terminals
        const secRes = await fetch('/api/departments/sections?limit=200')
        if (secRes.ok) {
          const secData = await secRes.json()
          const filteredSections = (secData.data || []).filter((s: Section) => s.hasTerminal && s.isActive)
          setSections(filteredSections)
        }
      } catch (e) {
        console.error('Failed to fetch sections:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchSectionsAndDepartments()
  }, [])

  // Load products for selected sections
  useEffect(() => {
    if (selectedSections.size === 0) {
      setProducts([])
      return
    }

    const loadProducts = async () => {
      try {
        const selectedArray = Array.from(selectedSections)
        const allProducts: Product[] = []

        for (const sectionId of selectedArray) {
          const section = sections.find(s => s.id === sectionId)
          if (!section) continue

          // Fetch section inventory
          try {
            const res = await fetch(`/api/departments/${encodeURIComponent(section.departmentId)}/inventory?sectionId=${sectionId}`)
            if (res.ok) {
              const data = await res.json()
              const sectionDept = departments.find(d => d.id === section.departmentId)
              const sectionProducts = (data.data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                price: p.price || 0,
                sectionId: section.id,
                sectionName: section.name,
                departmentCode: sectionDept?.code || '',
              }))
              allProducts.push(...sectionProducts)
            }
          } catch (e) {
            console.error(`Failed to fetch products for section ${sectionId}:`, e)
          }
        }

        setProducts(allProducts)
      } catch (e) {
        console.error('Failed to load products:', e)
      }
    }

    loadProducts()
  }, [selectedSections, sections, departments])

  const handleToggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedSections(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSections.size === sections.length) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(sections.map(s => s.id)))
    }
  }

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.basePrice,
              }
            : item
        )
      } else {
        return [
          ...prev,
          {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            basePrice: product.price,
            quantity: 1,
            subtotal: product.price,
            sectionId: product.sectionId,
            sectionName: product.sectionName,
            departmentCode: product.departmentCode,
          },
        ]
      }
    })
  }

  const handleUpdateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartId))
    } else {
      setCart(prev =>
        prev.map(item =>
          item.id === cartId
            ? { ...item, quantity, subtotal: quantity * item.basePrice }
            : item
        )
      )
    }
  }

  const handleRemoveFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartId))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    try {
      // Group items by department
      const itemsByDept: { [key: string]: CartItem[] } = {}
      cart.forEach(item => {
        if (!itemsByDept[item.departmentCode]) {
          itemsByDept[item.departmentCode] = []
        }
        itemsByDept[item.departmentCode].push(item)
      })

      // Create order for each department
      for (const [deptCode, items] of Object.entries(itemsByDept)) {
        const res = await fetch(`/api/departments/${encodeURIComponent(deptCode)}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.basePrice,
              sectionId: item.sectionId,
            })),
            notes: 'Sales Terminal Order',
          }),
        })

        if (!res.ok) {
          throw new Error(`Failed to create order for ${deptCode}`)
        }
      }

      alert('Orders created successfully')
      setCart([])
      setSelectedSections(new Set())
      setView('select')
    } catch (e: any) {
      console.error('Checkout error:', e)
      alert(e?.message || 'Failed to complete checkout')
    }
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sectionName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Section selection view
  if (view === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sales Terminal</h1>
            <p className="text-sm text-gray-600 mt-2">Select sections to start selling</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading sections...</p>
            </div>
          ) : sections.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600">No sections with terminal support available</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium text-sm"
                >
                  {selectedSections.size === sections.length
                    ? 'Deselect All'
                    : `Select All (${sections.length})`}
                </button>
                <span className="text-sm font-medium">
                  Selected: {selectedSections.size} / {sections.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {sections.map(section => {
                  const dept = departments.find(d => d.id === section.departmentId)
                  const isSelected = selectedSections.has(section.id)
                  return (
                    <div
                      key={section.id}
                      onClick={() => handleToggleSection(section.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 mt-1"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{section.name}</h3>
                          <p className="text-sm text-gray-600">{dept?.name || 'Unknown Department'}</p>
                          {section.slug && (
                            <p className="text-xs text-gray-500 mt-1">{section.slug}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => selectedSections.size > 0 && setView('terminal')}
                disabled={selectedSections.size === 0}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Start Terminal ({selectedSections.size} selected)
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Terminal view
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Terminal</h1>
            <p className="text-sm text-gray-600">
              {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={() => setView('select')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
          >
            Change Sections
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 max-w-7xl mx-auto w-full p-6">
        {/* Products Section */}
        <div className="flex-1">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-lg">
                <p className="text-gray-600">
                  {products.length === 0 ? 'No products available' : 'No products match your search'}
                </p>
              </div>
            ) : (
              filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left"
                >
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{product.sectionName}</div>
                  <div className="text-lg font-bold text-blue-600 mt-2">
                    ${(product.price / 100).toFixed(2)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white rounded-lg shadow-lg p-6 flex flex-col max-h-screen sticky top-24">
          <h2 className="text-xl font-bold mb-4">Cart</h2>

          <div className="flex-1 overflow-y-auto mb-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="p-3 bg-gray-50 rounded border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-gray-600">{item.sectionName}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border rounded py-1 text-sm"
                        min="1"
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-medium">
                      ${(item.subtotal / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg bg-blue-50 p-3 rounded">
              <span>Total:</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  )
}
