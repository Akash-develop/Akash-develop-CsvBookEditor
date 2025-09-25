'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from "xlsx";
import { useInfiniteScroll } from "./customHooks/useInfiniteScroll"; // ✅ reusable hook

const generateFakeBooks = (count = 10000) => {
  const genres = ['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-Help', 'Poetry'];
  const authors = ['John Smith', 'Emily Johnson', 'Michael Brown', 'Sarah Davis', 'David Wilson', 'Lisa Anderson', 'Robert Taylor', 'Jennifer Martinez', 'William Garcia', 'Maria Rodriguez'];
  
  const books = [];
  for (let i = 1; i <= count; i++) {
    books.push({
      id: i,
      Title: `Book Title ${i}`,
      Author: authors[Math.floor(Math.random() * authors.length)],
      Genre: genres[Math.floor(Math.random() * genres.length)],
      PublishedYear: Math.floor(Math.random() * (2024 - 1900) + 1900),
      ISBN: `978-${Math.floor(Math.random() * 9000000000) + 1000000000}`
    });
  }
  return books;
};

export default function Home() {
  const [books, setBooks] = useState<any[]>([]);
  const [originalBooks, setOriginalBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    title: '',
    author: '',
    genre: '',
    year: ''
  });
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [visibleItems, setVisibleItems] = useState(100);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [modifiedRows, setModifiedRows] = useState(new Set<number>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const itemsPerBatch = 50;

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = { id: i };
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    return data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvData = parseCSV(e.target?.result as string);
          setBooks(csvData);
          setOriginalBooks([...csvData]);
          setModifiedRows(new Set());
          setVisibleItems(100);
        } catch {
          alert('Error parsing CSV file');
        }
        setLoading(false);
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a valid CSV file');
    }
  };

  const handleGenerateData = () => {
    setLoading(true);
    setTimeout(() => {
      const fakeBooks = generateFakeBooks(10000);
      setBooks(fakeBooks);
      setOriginalBooks([...fakeBooks]);
      setModifiedRows(new Set());
      setVisibleItems(100);
      setLoading(false);
    }, 100);
  };

  const processedBooks = useMemo(() => {
    let result = [...books];
    
    if (filters.title) {
      result = result.filter(book => 
        book.Title.toLowerCase().includes(filters.title.toLowerCase())
      );
    }
    if (filters.author) {
      result = result.filter(book => 
        book.Author.toLowerCase().includes(filters.author.toLowerCase())
      );
    }
    if (filters.genre) {
      result = result.filter(book => 
        book.Genre.toLowerCase().includes(filters.genre.toLowerCase())
      );
    }
    if (filters.year) {
      result = result.filter(book => 
        book.PublishedYear.toString().includes(filters.year)
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key!];
        let bVal = b[sortConfig.key!];
        
        if (sortConfig.key === 'PublishedYear') {
          aVal = parseInt(aVal) || 0;
          bVal = parseInt(bVal) || 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [books, filters, sortConfig]);

  useEffect(() => {
    setVisibleItems(100);
    setIsLoadingMore(false);
  }, [filters, sortConfig]);

  const loadMoreData = useCallback(() => {
    if (isLoadingMore || visibleItems >= processedBooks.length) return;
    
    setIsLoadingMore(true);
    
    setTimeout(() => {
      setVisibleItems(prev => Math.min(prev + itemsPerBatch, processedBooks.length));
      setIsLoadingMore(false);
    }, 1000);
  }, [isLoadingMore, visibleItems, processedBooks.length, itemsPerBatch]);

  // ✅ Use custom hook instead of manual effect
  const { loadTriggerRef } = useInfiniteScroll({
    hasMore: visibleItems < processedBooks.length,
    isLoading: isLoadingMore,
    loadMore: loadMoreData,
    root: tableContainerRef.current,
    rootMargin: "100px",
    threshold: 0.1,
  });

  const currentBooks = processedBooks.slice(0, visibleItems);

  const handleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleInputChange = (bookId: number, field: string, value: string) => {
    setBooks(prevBooks => 
      prevBooks.map(book => 
        book.id === bookId ? { ...book, [field]: value } : book
      )
    );
    setModifiedRows(prev => new Set([...prev, bookId]));
  };

  const handleFinishEditing = () => setEditingCell(null);
  const handleResetEdits = () => {
    setBooks([...originalBooks]);
    setModifiedRows(new Set());
  };

  const handleDownloadExcel = () => {
    const headers = ['Title', 'Author', 'Genre', 'PublishedYear', 'ISBN'];
    const data = [headers, ...books.map(book => headers.map(h => String(book[h])))];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map(() => ({ wch: 25 }));
    ws['!rows'] = books.map(() => ({ hpt: 25 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Books');
    XLSX.writeFile(wb, 'edited_books.xlsx');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">CSV Book Data Editor</h1>

          {/* Upload/Generate Section */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                  Upload CSV File
                </button>
              </div>
              <button onClick={handleGenerateData} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                Generate Sample Data (10K books)
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          )}

          {books.length > 0 && !loading && (
            <>
              {/* Stats and Actions */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex gap-6 text-sm text-gray-600">
                    <span>Total Records: {books.length}</span>
                    <span>Filtered Records: {processedBooks.length}</span>
                    <span>Modified Rows: {modifiedRows.size}</span>
                    <span>Showing: {currentBooks.length} of {processedBooks.length}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleResetEdits} disabled={modifiedRows.size === 0} className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium text-sm">
                      Reset All Edits
                    </button>
                    <button onClick={handleDownloadExcel} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm">
                      Download CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <input type="text" placeholder="Filter by Title" value={filters.title} onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  <input type="text" placeholder="Filter by Author" value={filters.author} onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  <input type="text" placeholder="Filter by Genre" value={filters.genre} onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  <input type="text" placeholder="Filter by Year" value={filters.year} onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              {/* Data Table */}
              <div ref={tableContainerRef} className="overflow-auto bg-white rounded-lg border border-gray-200 max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {['Title', 'Author', 'Genre', 'PublishedYear', 'ISBN'].map((header) => (
                        <th key={header} onClick={() => handleSort(header)} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          <div className="flex items-center gap-1">
                            {header}
                            {sortConfig.key === header && (
                              <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentBooks.map((book) => (
                      <tr key={book.id} className={`hover:bg-gray-50 ${modifiedRows.has(book.id) ? 'bg-yellow-50' : ''}`}>
                        {['Title', 'Author', 'Genre', 'PublishedYear', 'ISBN'].map((field) => (
                          <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer hover:bg-blue-50 relative"
                            onClick={() => { if (editingCell !== `${book.id}-${field}`) setEditingCell(`${book.id}-${field}`); }}>
                            {editingCell === `${book.id}-${field}` ? (
                              <input type="text" value={book[field] || ''} onChange={(e) => handleInputChange(book.id, field, e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') handleFinishEditing(); e.stopPropagation(); }}
                                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) handleFinishEditing(); }}
                                autoFocus className="w-full border border-blue-500 outline-none bg-white px-2 py-1 rounded" />
                            ) : (
                              <span className={modifiedRows.has(book.id) ? 'text-orange-600 font-medium' : ''}>{book[field] || ''}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {visibleItems < processedBooks.length && (
                  <div ref={loadTriggerRef} className="h-1" />
                )}

                {!isLoadingMore && visibleItems < processedBooks.length && (
                  <div className="text-center py-6 border-t bg-gray-50">
                    <p className="text-sm text-gray-500">Scroll down to load more...</p>
                  </div>
                )}
                {isLoadingMore && (
                  <div className="text-center py-3 border-t bg-gray-50">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 font-medium">Loading more records...</p>
                  </div>
                )}
                {!isLoadingMore && currentBooks.length === processedBooks.length && processedBooks.length > 100 && (
                  <div className="text-center py-6 border-t bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex justify-center items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-semibold text-green-700">All {processedBooks.length.toLocaleString()} records loaded!</p>
                    </div>
                    <p className="text-xs text-gray-500">You've reached the end of the data</p>
                  </div>
                )}
              </div>
            </>
          )}

          {books.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Upload a CSV file or generate sample data to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
