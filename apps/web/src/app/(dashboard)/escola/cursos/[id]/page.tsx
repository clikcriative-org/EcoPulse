'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Users, Plus, Trash2, Award, Search, GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  order: number;
  duration: number | null;
  videoUrl: string | null;
  date: string | null;
}

interface Enrollment {
  id: string;
  status: string;
  progress: number;
  enrolledAt: string;
  member: { id: string; fullName: string; photoUrl: string | null };
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  mode: string;
  lessons: Lesson[];
  enrollments: Enrollment[];
  _count: { enrollments: number; lessons: number; certificates: number };
}

export default function CourseDetailPage() {
  const params = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lessons' | 'students'>('lessons');
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title: '', duration: '', order: '' });
  const [showEnroll, setShowEnroll] = useState(false);
  const [searchMembers, setSearchMembers] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => { loadCourse(); }, []);

  async function loadCourse() {
    try {
      const { data } = await api.get(`/school/courses/${params.id}`);
      setCourse(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/school/courses/${params.id}/lessons`, {
        title: lessonForm.title,
        order: parseInt(lessonForm.order) || (course?.lessons.length || 0) + 1,
        duration: lessonForm.duration ? parseInt(lessonForm.duration) : undefined,
      });
      setShowAddLesson(false);
      setLessonForm({ title: '', duration: '', order: '' });
      loadCourse();
    } catch (err: any) { alert(err.response?.data?.message || 'Erro'); }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm('Remover esta aula?')) return;
    try {
      await api.delete(`/school/courses/${params.id}/lessons/${lessonId}`);
      loadCourse();
    } catch (err: any) { alert(err.response?.data?.message || 'Erro'); }
  }

  async function searchAvailable(query: string) {
    setSearchMembers(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get('/members', { params: { search: query, limit: 10 } });
      const enrolledIds = new Set(course?.enrollments.map((e) => e.member.id) || []);
      setSearchResults(data.data.filter((m: any) => !enrolledIds.has(m.id)));
    } catch (err) { console.error(err); }
  }

  async function handleEnroll(memberId: string) {
    try {
      await api.post(`/school/courses/${params.id}/enroll`, { memberId });
      setShowEnroll(false);
      setSearchMembers('');
      setSearchResults([]);
      loadCourse();
    } catch (err: any) { alert(err.response?.data?.message || 'Erro'); }
  }

  async function handleComplete(memberId: string) {
    if (!confirm('Marcar como concluído e gerar certificado?')) return;
    try {
      await api.post(`/school/courses/${params.id}/complete/${memberId}`);
      loadCourse();
    } catch (err: any) { alert(err.response?.data?.message || 'Erro'); }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Carregando...</div>;
  if (!course) return <div className="py-20 text-center text-gray-400">Curso não encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/escola" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {course.category && <span>{course.category}</span>}
            <span className="capitalize">{course.mode}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-gray-900">{course._count.lessons}</p>
          <p className="text-xs text-gray-500">Aulas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-blue-600">{course._count.enrollments}</p>
          <p className="text-xs text-gray-500">Alunos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-amber-600">{course._count.certificates}</p>
          <p className="text-xs text-gray-500">Certificados</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('lessons')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'lessons' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          <BookOpen className="w-4 h-4 inline mr-2" />Aulas ({course.lessons.length})
        </button>
        <button onClick={() => setTab('students')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'students' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          <Users className="w-4 h-4 inline mr-2" />Alunos ({course.enrollments.length})
        </button>
      </div>

      {/* Lessons tab */}
      {tab === 'lessons' && (
        <div className="space-y-3">
          <button onClick={() => setShowAddLesson(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            <Plus className="w-4 h-4" /> Adicionar aula
          </button>

          {course.lessons.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Nenhuma aula adicionada</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {course.lessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                      {lesson.order}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{lesson.title}</p>
                      <p className="text-xs text-gray-500">
                        {lesson.duration ? `${lesson.duration} min` : ''}
                        {lesson.date ? ` • ${new Date(lesson.date).toLocaleDateString('pt-BR')}` : ''}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteLesson(lesson.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Students tab */}
      {tab === 'students' && (
        <div className="space-y-3">
          <button onClick={() => setShowEnroll(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            <Plus className="w-4 h-4" /> Matricular aluno
          </button>

          {course.enrollments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Nenhum aluno matriculado</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {course.enrollments.map((enrollment) => (
                <div key={enrollment.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-sm">{enrollment.member.fullName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{enrollment.member.fullName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={enrollment.status === 'COMPLETED' ? 'text-green-600' : enrollment.status === 'ACTIVE' ? 'text-blue-600' : 'text-gray-400'}>
                          {enrollment.status === 'COMPLETED' ? '✓ Concluído' : enrollment.status === 'ACTIVE' ? '● Ativo' : '○ ' + enrollment.status}
                        </span>
                        {enrollment.status === 'ACTIVE' && <span>• {enrollment.progress}%</span>}
                      </div>
                    </div>
                  </div>
                  {enrollment.status === 'ACTIVE' && (
                    <button onClick={() => handleComplete(enrollment.member.id)} className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium py-1.5 px-3 rounded-lg transition">
                      <Award className="w-3.5 h-3.5" /> Concluir
                    </button>
                  )}
                  {enrollment.status === 'COMPLETED' && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <GraduationCap className="w-3.5 h-3.5" /> Certificado
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add lesson modal */}
      {showAddLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Aula</h2>
            <form onSubmit={handleAddLesson} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input type="text" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordem</label>
                  <input type="number" value={lessonForm.order} onChange={(e) => setLessonForm({ ...lessonForm, order: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder={`${(course?.lessons.length || 0) + 1}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração (min)</label>
                  <input type="number" value={lessonForm.duration} onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition">Adicionar</button>
                <button type="button" onClick={() => setShowAddLesson(false)} className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Matricular Aluno</h2>
            <div className="space-y-4">
              <input type="text" value={searchMembers} onChange={(e) => searchAvailable(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Buscar membro..." autoFocus />
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {searchResults.map((m) => (
                    <button key={m.id} onClick={() => handleEnroll(m.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition text-left">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><span className="text-xs font-semibold text-gray-600">{m.fullName.charAt(0)}</span></div>
                      <span className="text-sm font-medium text-gray-900">{m.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setShowEnroll(false); setSearchMembers(''); setSearchResults([]); }} className="w-full mt-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
