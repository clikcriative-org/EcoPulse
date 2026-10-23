'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, BookOpen, Users, Award } from 'lucide-react';
import { api } from '@/lib/api';

interface Course {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  mode: string;
  startAt: string | null;
  _count: { enrollments: number; lessons: number };
}

interface Stats {
  totalCourses: number;
  totalEnrollments: number;
  totalCompleted: number;
  totalCertificates: number;
}

export default function EscolaPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCourses: 0, totalEnrollments: 0, totalCompleted: 0, totalCertificates: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [coursesRes, statsRes] = await Promise.all([
        api.get('/school/courses'),
        api.get('/school/stats'),
      ]);
      setCourses(coursesRes.data);
      setStats(statsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const modeLabel: Record<string, string> = { presential: 'Presencial', online: 'Online', hybrid: 'Híbrido' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escola</h1>
          <p className="text-gray-500 mt-1">Cursos, trilhas e certificados</p>
        </div>
        <Link href="/escola/novo-curso" className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Curso
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
              <p className="text-xs text-gray-500">Cursos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEnrollments}</p>
              <p className="text-xs text-gray-500">Matriculados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCompleted}</p>
              <p className="text-xs text-gray-500">Concluídos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCertificates}</p>
              <p className="text-xs text-gray-500">Certificados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Courses grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Carregando...</div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Nenhum curso criado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link key={course.id} href={`/escola/cursos/${course.id}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition">{course.name}</h3>
                  {course.category && <span className="text-xs text-gray-500">{course.category}</span>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                  {modeLabel[course.mode] || course.mode}
                </span>
              </div>
              {course.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{course.description}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{course._count.lessons} aulas</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course._count.enrollments} alunos</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
